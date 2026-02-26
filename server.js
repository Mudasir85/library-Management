const express = require('express');
const crypto = require('crypto');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));
if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
  loadEnvFile(path.join(__dirname, '.env.production'));
}

const app = express();
const PORT = process.env.PORT || 3001;
const BASE = '/mohit';
const FINE_PER_DAY = 5;
const FINE_GRACE_DAYS = 14;
app.set('trust proxy', 1);

// Accept both prefixed (/mohit/...) and non-prefixed (...) routes.
app.use((req, res, next) => {
  if (req.url === BASE || req.url.startsWith(BASE + '/')) {
    req.url = req.url.slice(BASE.length) || '/';
  }
  next();
});

// In-memory session store: { token: { username, createdAt } }
const sessions = {};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure uploads directory exists before each write (handles deployed environments)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'profile_image' ? 'user' : 'book';
    cb(null, prefix + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeSubtype = (file.mimetype || '').split('/')[1] || '';
    const mimeOk = allowedTypes.test(mimeSubtype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
    }
  }
});

// Middleware
app.use(express.json());

function formatDateForDb(date, endOfDay = false) {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const ss = String(parsed.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getPolicyDueDay(issueDateValue) {
  const issueDate = parseDateValue(issueDateValue);
  if (!issueDate) return null;
  return startOfDay(addDays(issueDate, FINE_GRACE_DAYS));
}

function generatePaymentReference(prefix) {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${ts}${rand}`;
}

function getPayPalMode() {
  const mode = String(
    getFirstEnvValue([
      'PAYPAL_MODE',
      'PAYPAL_ENV',
      'PAYPAL_ENVIRONMENT',
      'paypal_mode',
      'paypal_env',
      'paypal_environment'
    ]) || 'sandbox'
  ).trim().toLowerCase();
  return mode === 'live' ? 'live' : 'sandbox';
}

function getPayPalBaseUrl() {
  const mode = getPayPalMode();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function getFirstEnvValue(keys) {
  const env = process.env || {};
  const envLowerMap = {};
  for (const rawKey of Object.keys(env)) {
    envLowerMap[rawKey.toLowerCase()] = env[rawKey];
  }

  for (const key of keys) {
    const candidateKeys = [
      key,
      key.replace(/[.\-]/g, '_'),
      key.replace(/[._]/g, '-')
    ];

    let value = '';
    for (const candidateKey of candidateKeys) {
      const exactValue = env[candidateKey];
      if (String(exactValue || '').trim()) {
        value = String(exactValue).trim();
        break;
      }
      const lowerValue = envLowerMap[candidateKey.toLowerCase()];
      if (String(lowerValue || '').trim()) {
        value = String(lowerValue).trim();
        break;
      }
    }

    if (value) return value;
  }
  return '';
}

function getPayPalCredentials() {
  const mode = getPayPalMode();
  const isLiveMode = mode === 'live';

  const clientId = getFirstEnvValue(
    isLiveMode
      ? [
          'PAYPAL_LIVE_CLIENT_ID',
          'PAYPAL_CLIENT_ID_LIVE',
          'PAYPAL_PRODUCTION_CLIENT_ID',
          'PAYPAL_CLIENT_ID_PRODUCTION',
          'PAYPAL_CLIENT_ID',
          'PAYPAL_CLIENTID',
          'PAYPAL_PUBLIC_CLIENT_ID',
          'PAYPAL_PUBLIC_KEY',
          'REACT_APP_PAYPAL_CLIENT_ID',
          'VITE_PAYPAL_CLIENT_ID',
          'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
          'paypal_live_client_id',
          'paypal_client_id'
        ]
      : [
          'PAYPAL_SANDBOX_CLIENT_ID',
          'PAYPAL_CLIENT_ID_SANDBOX',
          'PAYPAL_TEST_CLIENT_ID',
          'PAYPAL_CLIENT_ID_TEST',
          'PAYPAL_CLIENT_ID',
          'PAYPAL_CLIENTID',
          'PAYPAL_PUBLIC_CLIENT_ID',
          'PAYPAL_PUBLIC_KEY',
          'REACT_APP_PAYPAL_CLIENT_ID',
          'VITE_PAYPAL_CLIENT_ID',
          'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
          'paypal_sandbox_client_id',
          'paypal_client_id'
        ]
  );
  const clientSecret = getFirstEnvValue(
    isLiveMode
      ? [
          'PAYPAL_LIVE_CLIENT_SECRET',
          'PAYPAL_CLIENT_SECRET_LIVE',
          'PAYPAL_PRODUCTION_CLIENT_SECRET',
          'PAYPAL_CLIENT_SECRET_PRODUCTION',
          'PAYPAL_CLIENT_SECRET',
          'PAYPAL_SECRET',
          'REACT_APP_PAYPAL_CLIENT_SECRET',
          'VITE_PAYPAL_CLIENT_SECRET',
          'paypal_live_client_secret',
          'paypal_client_secret'
        ]
      : [
          'PAYPAL_SANDBOX_CLIENT_SECRET',
          'PAYPAL_CLIENT_SECRET_SANDBOX',
          'PAYPAL_TEST_CLIENT_SECRET',
          'PAYPAL_CLIENT_SECRET_TEST',
          'PAYPAL_CLIENT_SECRET',
          'PAYPAL_SECRET',
          'REACT_APP_PAYPAL_CLIENT_SECRET',
          'VITE_PAYPAL_CLIENT_SECRET',
          'paypal_sandbox_client_secret',
          'paypal_client_secret'
        ]
  );

  return {
    clientId,
    clientSecret
  };
}

function getPayPalCurrencyCode() {
  return String(
    getFirstEnvValue([
      'PAYPAL_CURRENCY',
      'CURRENCY',
      'PAYPAL_CURRENCY_CODE',
      'REACT_APP_PAYPAL_CURRENCY',
      'VITE_PAYPAL_CURRENCY',
      'NEXT_PUBLIC_PAYPAL_CURRENCY',
      'paypal_currency'
    ]) || 'USD'
  ).trim().toUpperCase();
}

function paypalHttpRequest(options, body, cb) {
  const req = https.request(options, (res) => {
    let raw = '';
    res.on('data', (chunk) => {
      raw += chunk;
    });
    res.on('end', () => {
      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr) {
          parsed = null;
        }
      }
      cb(null, {
        statusCode: res.statusCode || 500,
        data: parsed,
        raw
      });
    });
  });

  req.on('error', (err) => cb(err));
  if (body) req.write(body);
  req.end();
}

function getPayPalAccessToken(cb) {
  const creds = getPayPalCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    return cb(new Error('PayPal is not configured on server. Missing PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET.'));
  }

  const baseUrl = new URL(getPayPalBaseUrl());
  const payload = 'grant_type=client_credentials';
  const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const options = {
    hostname: baseUrl.hostname,
    method: 'POST',
    path: '/v1/oauth2/token',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  paypalHttpRequest(options, payload, (err, response) => {
    if (err) return cb(err);
    const accessToken = response?.data?.access_token;
    if (response.statusCode < 200 || response.statusCode >= 300 || !accessToken) {
      return cb(new Error(response?.data?.error_description || 'Failed to authenticate with PayPal'));
    }
    cb(null, accessToken);
  });
}

function createPayPalOrder(amount, fineId, cb) {
  getPayPalAccessToken((tokenErr, accessToken) => {
    if (tokenErr) return cb(tokenErr);

    const baseUrl = new URL(getPayPalBaseUrl());
    const currencyCode = getPayPalCurrencyCode();
    const payloadObj = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `fine-${fineId}`,
          description: `Library fine payment #${fineId}`,
          amount: {
            currency_code: currencyCode,
            value: Number(amount || 0).toFixed(2)
          }
        }
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW'
      }
    };
    const payload = JSON.stringify(payloadObj);
    const options = {
      hostname: baseUrl.hostname,
      method: 'POST',
      path: '/v2/checkout/orders',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    paypalHttpRequest(options, payload, (orderErr, response) => {
      if (orderErr) return cb(orderErr);
      if (response.statusCode < 200 || response.statusCode >= 300 || !response?.data?.id) {
        return cb(new Error(response?.data?.message || 'Failed to create PayPal order'));
      }
      cb(null, response.data);
    });
  });
}

function capturePayPalOrder(orderId, cb) {
  getPayPalAccessToken((tokenErr, accessToken) => {
    if (tokenErr) return cb(tokenErr);

    const baseUrl = new URL(getPayPalBaseUrl());
    const options = {
      hostname: baseUrl.hostname,
      method: 'POST',
      path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': 2
      }
    };

    paypalHttpRequest(options, '{}', (captureErr, response) => {
      if (captureErr) return cb(captureErr);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return cb(new Error(response?.data?.message || 'Failed to capture PayPal payment'));
      }
      cb(null, response.data);
    });
  });
}

// Parse cookies from request
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=');
      cookies[name] = rest.join('=');
    });
  }
  return cookies;
}

// Check if request has a valid session
function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies.session_token;
  return token && sessions[token];
}

function clearSessionCookie(res) {
  const variants = [
    { httpOnly: true, sameSite: 'strict', path: '/' },
    { httpOnly: true, sameSite: 'lax', path: '/' }
  ];
  variants.forEach((opts) => {
    res.clearCookie('session_token', { ...opts, secure: true });
    res.clearCookie('session_token', { ...opts, secure: false });
  });
}

// Auth middleware - protect pages and API routes
function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  return res.redirect(BASE + '/login.html');
}

function syncFines(cb) {
  db.all('SELECT id, issue_date, return_date, status FROM issued_books', [], (err, rows) => {
    if (err) return cb(err);

    const today = startOfDay(new Date());
    const overdueRows = [];

    rows.forEach((row) => {
      const status = normalizeStatus(row.status);
      const dueDay = getPolicyDueDay(row.issue_date);
      if (!dueDay) return;
      let daysOverdue = 0;

      if (status === 'issued') {
        const diffMs = today.getTime() - dueDay.getTime();
        daysOverdue = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      } else if (status === 'returned') {
        const returnDate = parseDateValue(row.return_date);
        if (!returnDate) return;
        const returnDay = startOfDay(returnDate);
        const diffMs = returnDay.getTime() - dueDay.getTime();
        daysOverdue = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      }

      if (daysOverdue > 0) {
        overdueRows.push({
          issued_book_id: row.id,
          days_overdue: daysOverdue,
          fine_amount: Number((daysOverdue * FINE_PER_DAY).toFixed(2))
        });
      }
    });

    const overdueIds = overdueRows.map((r) => r.issued_book_id);
    const deleteSql = overdueIds.length > 0
      ? `DELETE FROM fines WHERE lower(trim(status)) = 'pending' AND issued_book_id NOT IN (${overdueIds.map(() => '?').join(',')})`
      : `DELETE FROM fines WHERE lower(trim(status)) = 'pending'`;

    db.run(deleteSql, overdueIds, (deleteErr) => {
      if (deleteErr) return cb(deleteErr);
      if (overdueRows.length === 0) return cb(null);

      let pending = overdueRows.length;
      let failed = false;

      overdueRows.forEach((r) => {
        db.run(
          `INSERT INTO fines (issued_book_id, days_overdue, fine_amount, status)
           VALUES (?, ?, ?, 'Pending')
           ON CONFLICT(issued_book_id) DO UPDATE SET
             days_overdue = excluded.days_overdue,
             fine_amount = excluded.fine_amount
           WHERE lower(trim(fines.status)) = 'pending'`,
          [r.issued_book_id, r.days_overdue, r.fine_amount],
          (upsertErr) => {
            pending -= 1;
            if (upsertErr && !failed) {
              failed = true;
              return cb(upsertErr);
            }
            if (pending === 0 && !failed) cb(null);
          }
        );
      });
    });
  });
}

// Serve login.html publicly
app.get('/', (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect(BASE + '/index.html');
  }
  res.redirect(BASE + '/login.html');
});

app.get('/login.html', (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect(BASE + '/index.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Protect index.html and contact.html - must be before static middleware
app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/contact.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/collect-fine.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collect-fine.html'));
});

// Serve other static assets publicly (but index: false prevents auto-serving index.html)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    password TEXT NOT NULL,
    profile_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add users columns for existing databases
db.all('PRAGMA table_info(users)', [], (err, columns) => {
  if (err) return;
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes('created_at')) {
    db.run('ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
  }
  if (!colNames.includes('profile_image')) {
    db.run('ALTER TABLE users ADD COLUMN profile_image TEXT');
  }
});

// Create class master table
db.run(`
  CREATE TABLE IF NOT EXISTS class_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create book master table
db.run(`
  CREATE TABLE IF NOT EXISTS book_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_name TEXT NOT NULL,
    author_name TEXT NOT NULL,
    publisher_name TEXT NOT NULL,
    isbn TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_name, author_name, publisher_name)
  )
`);

db.all('PRAGMA table_info(book_master)', [], (err, columns) => {
  if (err) return;
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes('total_copies')) {
    db.run('ALTER TABLE book_master ADD COLUMN total_copies INTEGER NOT NULL DEFAULT 1');
  }
});

// Create contact_messages table
db.run(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create books table
db.run(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_name TEXT NOT NULL,
    class TEXT NOT NULL,
    author_name TEXT NOT NULL,
    publisher_name TEXT NOT NULL,
    isbn TEXT,
    book_master_id INTEGER,
    class_master_id INTEGER,
    book_image TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_master_id) REFERENCES book_master(id),
    FOREIGN KEY (class_master_id) REFERENCES class_master(id)
  )
`);

// Add books columns for existing databases
db.all('PRAGMA table_info(books)', [], (err, columns) => {
  if (err) return;
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes('total_copies')) {
    db.run('ALTER TABLE books ADD COLUMN total_copies INTEGER NOT NULL DEFAULT 1');
  }
  if (!colNames.includes('available_copies')) {
    db.run('ALTER TABLE books ADD COLUMN available_copies INTEGER NOT NULL DEFAULT 1');
  }
  if (!colNames.includes('isbn')) {
    db.run('ALTER TABLE books ADD COLUMN isbn TEXT');
  }
  if (!colNames.includes('book_master_id')) {
    db.run('ALTER TABLE books ADD COLUMN book_master_id INTEGER');
  }
  if (!colNames.includes('class_master_id')) {
    db.run('ALTER TABLE books ADD COLUMN class_master_id INTEGER');
  }
});

// Backfill class/book master from existing books
db.run(`
  INSERT OR IGNORE INTO class_master (class_name)
  SELECT DISTINCT class FROM books WHERE class IS NOT NULL AND trim(class) <> ''
`);

db.run(`
  INSERT OR IGNORE INTO book_master (book_name, author_name, publisher_name, isbn, total_copies)
  SELECT DISTINCT book_name, author_name, publisher_name, isbn, COALESCE(total_copies, 1)
  FROM books
  WHERE book_name IS NOT NULL AND author_name IS NOT NULL AND publisher_name IS NOT NULL
`);

db.run(`
  UPDATE books
  SET class_master_id = (
    SELECT cm.id FROM class_master cm WHERE cm.class_name = books.class
  )
  WHERE class_master_id IS NULL
`);

db.run(`
  UPDATE books
  SET book_master_id = (
    SELECT bm.id
    FROM book_master bm
    WHERE bm.book_name = books.book_name
      AND bm.author_name = books.author_name
      AND bm.publisher_name = books.publisher_name
    LIMIT 1
  )
  WHERE book_master_id IS NULL
`);

// Create issued_books table for tracking book issues and returns
db.run(`
  CREATE TABLE IF NOT EXISTS issued_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    return_date DATETIME,
    status TEXT NOT NULL DEFAULT 'Issued',
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Add due_date column if it doesn't exist (for existing databases)
db.all('PRAGMA table_info(issued_books)', [], (err, columns) => {
  if (err) return;
  const colNames = columns.map(c => c.name);
  if (!colNames.includes('due_date')) {
    db.run('ALTER TABLE issued_books ADD COLUMN due_date DATETIME');
    // Set due_date for existing records that don't have it (14 days from issue_date)
    db.run("UPDATE issued_books SET due_date = datetime(issue_date, '+14 days') WHERE due_date IS NULL");
  }
});

// Create fines table
db.run(`
  CREATE TABLE IF NOT EXISTS fines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issued_book_id INTEGER NOT NULL UNIQUE,
    days_overdue INTEGER NOT NULL DEFAULT 0,
    fine_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    payment_type TEXT,
    payment_reference TEXT,
    payment_notes TEXT,
    collected_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issued_book_id) REFERENCES issued_books(id)
  )
`);

db.all('PRAGMA table_info(fines)', [], (err, columns) => {
  if (err) return;
  const colNames = columns.map((c) => c.name);
  if (!colNames.includes('payment_type')) {
    db.run('ALTER TABLE fines ADD COLUMN payment_type TEXT');
  }
  if (!colNames.includes('payment_reference')) {
    db.run('ALTER TABLE fines ADD COLUMN payment_reference TEXT');
  }
  if (!colNames.includes('payment_notes')) {
    db.run('ALTER TABLE fines ADD COLUMN payment_notes TEXT');
  }

  db.run("UPDATE fines SET payment_type = 'Offline' WHERE lower(trim(status)) = 'collected' AND (payment_type IS NULL OR trim(payment_type) = '')");
});

db.run(`
  CREATE TABLE IF NOT EXISTS fine_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fine_id INTEGER,
    issued_book_id INTEGER,
    user_id INTEGER,
    book_id INTEGER,
    amount REAL NOT NULL,
    payment_type TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Success',
    transaction_id TEXT,
    payment_gateway TEXT,
    payment_reference TEXT,
    payment_notes TEXT,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Default admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// POST /api/login - Authenticate user (public route)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { username, createdAt: Date.now() };

    // Set cookie (httpOnly so JS can't steal it)
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({ message: 'Login successful', username });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

// POST /api/logout - End session
app.post('/api/logout', (req, res) => {
  const token = parseCookies(req).session_token;
  if (token && sessions[token]) {
    delete sessions[token];
  }
  // Clear session cookie - match all possible path/sameSite/secure combinations
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const paths = ['/', '/mohit', '/mohit/'];
  const sameSiteOpts = ['strict', 'lax', 'none'];
  paths.forEach(p => {
    sameSiteOpts.forEach(ss => {
      res.clearCookie('session_token', { httpOnly: true, path: p, sameSite: ss, secure: isSecure });
      if (isSecure) {
        res.clearCookie('session_token', { httpOnly: true, path: p, sameSite: ss, secure: false });
      }
    });
    // Also clear without sameSite attribute
    res.clearCookie('session_token', { httpOnly: true, path: p });
  });
  return res.json({ message: 'Logout successful' });
});

function requireApiAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please login.' });
}

// Protect all API routes except login/logout
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') {
    return next();
  }
  return requireApiAuth(req, res, next);
});

// Also protect non-prefixed users endpoints
app.use('/users', requireApiAuth);

// GET /api/dashboard/stats - Dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch stats' });
    stats.totalUsers = row.count;

    db.get('SELECT COUNT(*) as count FROM books', [], (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch stats' });
      stats.totalBooks = row2.count;

      db.get("SELECT COUNT(*) as count FROM issued_books WHERE lower(trim(status)) = 'issued'", [], (err3, row3) => {
        if (err3) {
          stats.totalIssued = 0;
        } else {
          stats.totalIssued = row3.count;
        }
        res.json(stats);
      });
    });
  });
});

// Validation helpers
function validateUser(data, isUpdate = false) {
  const errors = [];

  if (!data.full_name || data.full_name.trim().length < 2 || data.full_name.trim().length > 50) {
    errors.push('Full Name must be between 2 and 50 characters');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('A valid email is required');
  }

  if (!data.phone || !/^\d{10}$/.test(data.phone)) {
    errors.push('Phone must be exactly 10 digits');
  }

  const validRoles = ['Admin', 'User', 'Guest'];
  if (!data.role || !validRoles.includes(data.role)) {
    errors.push('Role must be Admin, User, or Guest');
  }

  if (!isUpdate && (!data.password || data.password.length < 8)) {
    errors.push('Password must be at least 8 characters');
  }

  if (isUpdate && data.password && data.password.length > 0 && data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  return errors;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function listUsers(req, res) {
  db.all('SELECT id, full_name, email, phone, role, profile_image, created_at FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(rows);
  });
}

function createUser(req, res) {
  const errors = validateUser(req.body);
  if (errors.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  const full_name = req.body.full_name.trim();
  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  const role = req.body.role;
  const password = hashPassword(req.body.password);
  const profileImage = req.file ? '/uploads/' + req.file.filename : null;

  db.run(
    'INSERT INTO users (full_name, email, phone, role, password, profile_image) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, email, phone, role, password, profileImage],
    function (err) {
      if (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Failed to add user' });
      }
      res.status(201).json({ id: this.lastID, full_name, email, phone, role, profile_image: profileImage });
    }
  );
}

function updateUser(req, res) {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const errors = validateUser(req.body, true);
  if (errors.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  const full_name = req.body.full_name.trim();
  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  const role = req.body.role;
  const password = req.body.password;

  db.get('SELECT id, profile_image FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'User not found' });
    }

    let profileImage = row.profile_image || null;
    if (req.file) {
      if (profileImage) {
        const oldPath = path.join(__dirname, 'public', profileImage.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      profileImage = '/uploads/' + req.file.filename;
    }

    let query;
    let params;
    if (password && password.length > 0) {
      const hashedPassword = hashPassword(password);
      query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, password = ?, profile_image = ? WHERE id = ?';
      params = [full_name, email, phone, role, hashedPassword, profileImage, id];
    } else {
      query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, profile_image = ? WHERE id = ?';
      params = [full_name, email, phone, role, profileImage, id];
    }

    db.run(query, params, function (runErr) {
      if (runErr) {
        if (req.file) fs.unlinkSync(req.file.path);
        if (runErr.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Failed to update user' });
      }
      res.json({ message: 'User updated successfully' });
    });
  });
}

function deleteUser(req, res) {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  db.get('SELECT profile_image FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'User not found' });

    db.run('DELETE FROM users WHERE id = ?', [id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Failed to delete user' });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

      if (row.profile_image) {
        const imgPath = path.join(__dirname, 'public', row.profile_image.replace(/^\//, ''));
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
      res.json({ message: 'User deleted successfully' });
    });
  });
}

// Users API - both with and without /api prefix
app.get('/api/users', listUsers);
app.post('/api/users', upload.single('profile_image'), createUser);
app.put('/api/users/:id', upload.single('profile_image'), updateUser);
app.delete('/api/users/:id', deleteUser);

app.get('/users', listUsers);
app.post('/users', upload.single('profile_image'), createUser);
app.put('/users/:id', upload.single('profile_image'), updateUser);
app.delete('/users/:id', deleteUser);

// --- CLASS MASTER API ---
app.get('/api/class-master', (req, res) => {
  db.all('SELECT * FROM class_master ORDER BY class_name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch classes' });
    res.json(rows);
  });
});

app.post('/api/class-master', (req, res) => {
  const className = String(req.body.class_name || '').trim();
  const description = String(req.body.description || '').trim();

  if (!className || className.length > 100) {
    return res.status(400).json({ error: 'Class Name is required (max 100 characters)' });
  }

  db.run(
    'INSERT INTO class_master (class_name, description) VALUES (?, ?)',
    [className, description || null],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Class already exists' });
        }
        return res.status(500).json({ error: 'Failed to add class' });
      }
      res.status(201).json({ id: this.lastID, class_name: className, description: description || null });
    }
  );
});

app.put('/api/class-master/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid class id' });

  const className = String(req.body.class_name || '').trim();
  const description = String(req.body.description || '').trim();

  if (!className || className.length > 100) {
    return res.status(400).json({ error: 'Class Name is required (max 100 characters)' });
  }

  db.run(
    'UPDATE class_master SET class_name = ?, description = ? WHERE id = ?',
    [className, description || null, id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Class already exists' });
        }
        return res.status(500).json({ error: 'Failed to update class' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Class not found' });

      db.run('UPDATE books SET class = ? WHERE class_master_id = ?', [className, id], () => {
        res.json({ message: 'Class updated successfully' });
      });
    }
  );
});

app.delete('/api/class-master/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid class id' });

  db.get('SELECT COUNT(*) as count FROM books WHERE class_master_id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row && row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete class. It is used in books records.' });
    }

    db.run('DELETE FROM class_master WHERE id = ?', [id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Failed to delete class' });
      if (this.changes === 0) return res.status(404).json({ error: 'Class not found' });
      res.json({ message: 'Class deleted successfully' });
    });
  });
});

// --- BOOK MASTER API ---
app.get('/api/book-master', (req, res) => {
  db.all('SELECT * FROM book_master ORDER BY book_name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch book master data' });
    res.json(rows);
  });
});

app.post('/api/book-master', (req, res) => {
  const bookName = String(req.body.book_name || '').trim();
  const authorName = String(req.body.author_name || '').trim();
  const publisherName = String(req.body.publisher_name || '').trim();
  const isbn = String(req.body.isbn || '').trim();
  const totalCopies = parsePositiveInteger(req.body.total_copies) || 1;

  const errors = [];
  if (!bookName || bookName.length < 2 || bookName.length > 100) {
    errors.push('Book Name must be between 2 and 100 characters');
  }
  if (!authorName || authorName.length < 2 || authorName.length > 100) {
    errors.push('Author Name must be between 2 and 100 characters');
  }
  if (!publisherName || publisherName.length < 2 || publisherName.length > 100) {
    errors.push('Publisher Name must be between 2 and 100 characters');
  }
  if (isbn && isbn.length > 20) {
    errors.push('ISBN must be up to 20 characters');
  }
  if (totalCopies < 1 || totalCopies > 9999) {
    errors.push('Total Copies must be between 1 and 9999');
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.run(
    'INSERT INTO book_master (book_name, author_name, publisher_name, isbn, total_copies) VALUES (?, ?, ?, ?, ?)',
    [bookName, authorName, publisherName, isbn || null, totalCopies],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Book master record already exists' });
        }
        return res.status(500).json({ error: 'Failed to add book master record' });
      }
      res.status(201).json({
        id: this.lastID,
        book_name: bookName,
        author_name: authorName,
        publisher_name: publisherName,
        isbn: isbn || null,
        total_copies: totalCopies
      });
    }
  );
});

app.put('/api/book-master/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid book master id' });

  const bookName = String(req.body.book_name || '').trim();
  const authorName = String(req.body.author_name || '').trim();
  const publisherName = String(req.body.publisher_name || '').trim();
  const isbn = String(req.body.isbn || '').trim();
  const totalCopies = parsePositiveInteger(req.body.total_copies) || 1;

  const errors = [];
  if (!bookName || bookName.length < 2 || bookName.length > 100) {
    errors.push('Book Name must be between 2 and 100 characters');
  }
  if (!authorName || authorName.length < 2 || authorName.length > 100) {
    errors.push('Author Name must be between 2 and 100 characters');
  }
  if (!publisherName || publisherName.length < 2 || publisherName.length > 100) {
    errors.push('Publisher Name must be between 2 and 100 characters');
  }
  if (isbn && isbn.length > 20) {
    errors.push('ISBN must be up to 20 characters');
  }
  if (totalCopies < 1 || totalCopies > 9999) {
    errors.push('Total Copies must be between 1 and 9999');
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.run(
    'UPDATE book_master SET book_name = ?, author_name = ?, publisher_name = ?, isbn = ?, total_copies = ? WHERE id = ?',
    [bookName, authorName, publisherName, isbn || null, totalCopies, id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Book master record already exists' });
        }
        return res.status(500).json({ error: 'Failed to update book master record' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Book master record not found' });

      db.run(
        `UPDATE books
         SET book_name = ?, author_name = ?, publisher_name = ?, isbn = ?, total_copies = ?,
             available_copies = CASE
               WHEN (total_copies - available_copies) >= ? THEN 0
               ELSE ? - (total_copies - available_copies)
             END
         WHERE book_master_id = ?`,
        [bookName, authorName, publisherName, isbn || null, totalCopies, totalCopies, totalCopies, id],
        () => res.json({ message: 'Book master record updated successfully' })
      );
    }
  );
});

app.delete('/api/book-master/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid book master id' });

  db.get('SELECT COUNT(*) as count FROM books WHERE book_master_id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row && row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete book master record. It is used in books records.' });
    }

    db.run('DELETE FROM book_master WHERE id = ?', [id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: 'Failed to delete book master record' });
      if (this.changes === 0) return res.status(404).json({ error: 'Book master record not found' });
      res.json({ message: 'Book master record deleted successfully' });
    });
  });
});

// --- BOOKS API ---

// GET /api/books/available - Get books with available_copies > 0 (for issue dropdown)
// NOTE: Must be defined before /api/books/:id to avoid route conflict
app.get('/api/books/available', (req, res) => {
  db.all('SELECT id, book_name, author_name, available_copies FROM books WHERE available_copies > 0 ORDER BY book_name ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch available books' });
    }
    res.json(rows);
  });
});

// GET /api/books - List all books
app.get('/api/books', (req, res) => {
  db.all(`
    SELECT b.*,
           bm.book_name AS master_book_name,
           bm.author_name AS master_author_name,
           bm.publisher_name AS master_publisher_name,
           bm.isbn AS master_isbn,
           cm.class_name AS master_class_name
    FROM books b
    LEFT JOIN book_master bm ON bm.id = b.book_master_id
    LEFT JOIN class_master cm ON cm.id = b.class_master_id
    ORDER BY b.id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch books' });
    }
    res.json(rows);
  });
});

// POST /api/books - Add a book
app.post('/api/books', upload.single('book_image'), (req, res) => {
  const { book_master_id, class_master_id, total_copies } = req.body;
  const errors = [];

  const parsedBookMasterId = parsePositiveInteger(book_master_id);
  const parsedClassMasterId = parsePositiveInteger(class_master_id);

  if (!parsedBookMasterId) errors.push('Book Name is required');
  if (!parsedClassMasterId) errors.push('Class is required');

  const requestedCopies = parsePositiveInteger(total_copies);
  if (requestedCopies && requestedCopies > 9999) {
    errors.push('Total Copies must be between 1 and 9999');
  }

  if (errors.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.get('SELECT * FROM book_master WHERE id = ?', [parsedBookMasterId], (bookErr, masterBook) => {
    if (bookErr) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!masterBook) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Selected Book Name is invalid' });
    }

    db.get('SELECT * FROM class_master WHERE id = ?', [parsedClassMasterId], (classErr, masterClass) => {
      if (classErr) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!masterClass) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Selected Class is invalid' });
      }

      const bookImage = req.file ? '/uploads/' + req.file.filename : null;
      const copies = requestedCopies || parsePositiveInteger(masterBook.total_copies) || 1;

      db.run(
        `INSERT INTO books
          (book_name, class, author_name, publisher_name, isbn, book_master_id, class_master_id, book_image, total_copies, available_copies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          masterBook.book_name,
          masterClass.class_name,
          masterBook.author_name,
          masterBook.publisher_name,
          masterBook.isbn || null,
          parsedBookMasterId,
          parsedClassMasterId,
          bookImage,
          copies,
          copies
        ],
        function (err) {
          if (err) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: 'Failed to add book' });
          }
          res.status(201).json({
            id: this.lastID,
            book_name: masterBook.book_name,
            class: masterClass.class_name,
            author_name: masterBook.author_name,
            publisher_name: masterBook.publisher_name,
            isbn: masterBook.isbn || null,
            book_master_id: parsedBookMasterId,
            class_master_id: parsedClassMasterId,
            book_image: bookImage,
            total_copies: copies,
            available_copies: copies
          });
        }
      );
    });
  });
});

// PUT /api/books/:id - Edit a book
app.put('/api/books/:id', upload.single('book_image'), (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid book id' });
  }

  const { book_master_id, class_master_id, total_copies } = req.body;
  const errors = [];

  const parsedBookMasterId = parsePositiveInteger(book_master_id);
  const parsedClassMasterId = parsePositiveInteger(class_master_id);

  if (!parsedBookMasterId) errors.push('Book Name is required');
  if (!parsedClassMasterId) errors.push('Class is required');

  const requestedTotalCopies = parsePositiveInteger(total_copies);
  if ((total_copies !== undefined && total_copies !== '' && !requestedTotalCopies) || (requestedTotalCopies && requestedTotalCopies > 9999)) {
    errors.push('Total Copies must be between 1 and 9999');
  }

  if (errors.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
    if (err) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Book not found' });
    }

    db.get('SELECT * FROM book_master WHERE id = ?', [parsedBookMasterId], (bookErr, masterBook) => {
      if (bookErr) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!masterBook) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Selected Book Name is invalid' });
      }

      db.get('SELECT * FROM class_master WHERE id = ?', [parsedClassMasterId], (classErr, masterClass) => {
        if (classErr) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Database error' });
        }
        if (!masterClass) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'Selected Class is invalid' });
        }

        let bookImage = row.book_image;
        if (req.file) {
          if (row.book_image) {
            const oldPath = path.join(__dirname, 'public', row.book_image.replace(/^\//, ''));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          bookImage = '/uploads/' + req.file.filename;
        }

        // Calculate new available_copies based on total_copies change
        let updatedTotalCopies = row.total_copies || 1;
        let updatedAvailableCopies = row.available_copies || 0;
        const targetTotalCopies = requestedTotalCopies || parsePositiveInteger(masterBook.total_copies) || updatedTotalCopies;
        if (targetTotalCopies >= 1) {
          const issuedCount = updatedTotalCopies - updatedAvailableCopies;
          updatedTotalCopies = targetTotalCopies;
          updatedAvailableCopies = Math.max(0, targetTotalCopies - issuedCount);
        }

        db.run(
          `UPDATE books
           SET book_name = ?, class = ?, author_name = ?, publisher_name = ?, isbn = ?, book_master_id = ?, class_master_id = ?, book_image = ?, total_copies = ?, available_copies = ?
           WHERE id = ?`,
          [
            masterBook.book_name,
            masterClass.class_name,
            masterBook.author_name,
            masterBook.publisher_name,
            masterBook.isbn || null,
            parsedBookMasterId,
            parsedClassMasterId,
            bookImage,
            updatedTotalCopies,
            updatedAvailableCopies,
            id
          ],
          function (updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: 'Failed to update book' });
            }
            res.json({ message: 'Book updated successfully' });
          }
        );
      });
    });
  });
});

// DELETE /api/books/:id - Delete a book
app.delete('/api/books/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid book id' });

  // Check if book has any active issues
  db.get("SELECT COUNT(*) as count FROM issued_books WHERE book_id = ? AND status = 'Issued'", [id], (err, issueRow) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (issueRow && issueRow.count > 0) {
      return res.status(400).json({ error: 'Cannot delete book. It has ' + issueRow.count + ' active issue(s). Return all copies first.' });
    }

    db.get('SELECT book_image FROM books WHERE id = ?', [id], (getErr, row) => {
      if (getErr) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'Book not found' });

      // Delete associated image file
      if (row.book_image) {
        const imgPath = path.join(__dirname, 'public', row.book_image.replace(/^\//, ''));
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }

      db.run('DELETE FROM books WHERE id = ?', [id], function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: 'Failed to delete book' });
        res.json({ message: 'Book deleted successfully' });
      });
    });
  });
});

// --- ISSUE BOOKS API ---

// GET /api/issued-books - List all issued books
app.get('/api/issued-books', (req, res) => {
  db.all(`
    SELECT ib.id, ib.book_id, ib.user_id, ib.issue_date, ib.due_date, ib.return_date, ib.status,
           b.book_name, b.author_name,
           u.full_name as user_name, u.email as user_email
    FROM issued_books ib
    JOIN books b ON ib.book_id = b.id
    JOIN users u ON ib.user_id = u.id
    ORDER BY ib.id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch issued books' });
    }
    res.json(rows);
  });
});

// GET /api/issued-books/summary - Issue summary stats
app.get('/api/issued-books/summary', (req, res) => {
  db.all('SELECT status, issue_date FROM issued_books', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch summary' });

    const today = startOfDay(new Date());
    let totalIssued = 0;
    let totalReturned = 0;
    let totalOverdue = 0;

    rows.forEach((row) => {
      const status = normalizeStatus(row.status);
      if (status === 'issued') {
        const policyDueDay = getPolicyDueDay(row.issue_date);
        if (policyDueDay && policyDueDay < today) {
          totalOverdue += 1;
        } else {
          totalIssued += 1;
        }
      } else if (status === 'returned') {
        totalReturned += 1;
      }
    });

    res.json({
      totalIssued,
      totalReturned,
      totalOverdue
    });
  });
});

// POST /api/issued-books - Issue a book
app.post('/api/issued-books', (req, res) => {
  const { book_id, user_id, issue_date, due_date } = req.body;
  const errors = [];

  if (!book_id) errors.push('Book is required');
  if (!user_id) errors.push('User is required');
  if (!issue_date) errors.push('Issue date is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  const issueDateDb = formatDateForDb(issue_date);
  const dueDateDb = due_date ? formatDateForDb(due_date, true) : null;

  if (!issueDateDb) {
    return res.status(400).json({ error: 'Invalid issue date' });
  }
  if (due_date && !dueDateDb) {
    return res.status(400).json({ error: 'Invalid due date' });
  }

  if (dueDateDb && dueDateDb < issueDateDb) {
    return res.status(400).json({ error: 'Due date cannot be earlier than issue date' });
  }

  // Check if book has available copies
  db.get('SELECT * FROM books WHERE id = ?', [book_id], (err, book) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available_copies <= 0) {
      return res.status(400).json({ error: 'No available copies of this book' });
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE id = ?', [user_id], (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Check if this user already has this book issued (not returned)
      db.get('SELECT id FROM issued_books WHERE book_id = ? AND user_id = ? AND status = ?', [book_id, user_id, 'Issued'], (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (existing) {
          return res.status(400).json({ error: 'This user already has this book issued' });
        }

        db.run('INSERT INTO issued_books (book_id, user_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)', [book_id, user_id, issueDateDb, dueDateDb, 'Issued'], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to issue book' });

          const insertedId = this.lastID;
          db.run('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update book availability' });

            res.status(201).json({ id: insertedId, message: 'Book issued successfully' });
          });
        });
      });
    });
  });
});

// PUT /api/issued-books/:id/return - Return a book
app.put('/api/issued-books/:id/return', (req, res) => {
  const { id } = req.params;
  const { return_date } = req.body || {};

  db.get('SELECT * FROM issued_books WHERE id = ?', [id], (err, issued) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!issued) return res.status(404).json({ error: 'Issued record not found' });

    const returnDateDb = formatDateForDb(return_date || new Date().toISOString().slice(0, 10), true);
    if (!returnDateDb) {
      return res.status(400).json({ error: 'Invalid return date' });
    }
    if (issued.issue_date && returnDateDb < issued.issue_date) {
      return res.status(400).json({ error: 'Return date cannot be earlier than issue date' });
    }

    const alreadyReturned = normalizeStatus(issued.status) === 'returned';
    const updateSql = alreadyReturned
      ? 'UPDATE issued_books SET return_date = ? WHERE id = ?'
      : 'UPDATE issued_books SET status = ?, return_date = ? WHERE id = ?';
    const updateParams = alreadyReturned
      ? [returnDateDb, id]
      : ['Returned', returnDateDb, id];

    db.run(updateSql, updateParams, function(err) {
      if (err) return res.status(500).json({ error: 'Failed to return book' });

      if (alreadyReturned) {
        return res.json({ message: 'Return date updated successfully' });
      }

      db.run('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [issued.book_id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update book availability' });
        res.json({ message: 'Book returned successfully' });
      });
    });
  });
});

// DELETE /api/issued-books/:id - Delete an issued book record
app.delete('/api/issued-books/:id', (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Invalid issued book id' });
  }

  db.get('SELECT * FROM issued_books WHERE id = ?', [id], (err, issued) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!issued) return res.status(404).json({ error: 'Issued record not found' });

    // Delete associated fines first
    db.run('DELETE FROM fines WHERE issued_book_id = ?', [id], (fineErr) => {
      if (fineErr) return res.status(500).json({ error: 'Failed to delete associated fines' });

      db.run('DELETE FROM issued_books WHERE id = ?', [id], function(delErr) {
        if (delErr) return res.status(500).json({ error: 'Failed to delete issued book record' });

        // If book was still issued (not returned), restore the available copy
        if (normalizeStatus(issued.status) === 'issued') {
          db.run('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [issued.book_id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Record deleted but failed to restore book availability' });
            return res.json({ message: 'Issued book record deleted successfully' });
          });
        } else {
          return res.json({ message: 'Issued book record deleted successfully' });
        }
      });
    });
  });
});

// --- FINES API ---
app.get('/api/fines/summary', (req, res) => {
  syncFines((syncErr) => {
    if (syncErr) return res.status(500).json({ error: 'Failed to fetch fine summary' });

    const summary = { totalCollected: 0, totalPending: 0 };
    db.get("SELECT ROUND(COALESCE(SUM(fine_amount), 0), 2) AS total FROM fines WHERE lower(trim(status)) = 'collected'", [], (err, collected) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch fine summary' });
      summary.totalCollected = Number(collected?.total || 0);

      db.get("SELECT ROUND(COALESCE(SUM(fine_amount), 0), 2) AS total FROM fines WHERE lower(trim(status)) = 'pending'", [], (err2, pending) => {
        if (err2) return res.status(500).json({ error: 'Failed to fetch fine summary' });
        summary.totalPending = Number(pending?.total || 0);
        res.json(summary);
      });
    });
  });
});

app.get('/api/fines', (req, res) => {
  syncFines((syncErr) => {
    if (syncErr) return res.status(500).json({ error: 'Failed to fetch fines' });

    db.all(
      `SELECT
         f.id,
         f.issued_book_id,
         COALESCE(u.full_name, 'Unknown User') AS user_name,
         COALESCE(b.book_name, 'Unknown Book') AS book_name,
         f.days_overdue,
         ROUND(f.fine_amount, 2) AS fine_amount,
         f.status,
         COALESCE(f.payment_type, '') AS payment_type
       FROM fines f
       LEFT JOIN issued_books ib ON ib.id = f.issued_book_id
       LEFT JOIN users u ON u.id = ib.user_id
       LEFT JOIN books b ON b.id = ib.book_id
       ORDER BY f.id DESC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch fines' });
        res.json(rows);
      }
    );
  });
});

app.get('/api/fines/:id', (req, res) => {
  const { id } = req.params;
  syncFines((syncErr) => {
    if (syncErr) return res.status(500).json({ error: 'Failed to fetch fine details' });

    db.get(
      `SELECT
         f.id,
         f.issued_book_id,
         COALESCE(u.full_name, 'Unknown User') AS user_name,
         COALESCE(u.email, '-') AS user_email,
         COALESCE(b.book_name, 'Unknown Book') AS book_name,
         COALESCE(b.author_name, '-') AS author_name,
         COALESCE(b.publisher_name, '-') AS publisher_name,
         f.days_overdue,
         ROUND(f.fine_amount, 2) AS fine_amount,
         f.status,
         COALESCE(f.payment_type, '') AS payment_type
       FROM fines f
       LEFT JOIN issued_books ib ON ib.id = f.issued_book_id
       LEFT JOIN users u ON u.id = ib.user_id
       LEFT JOIN books b ON b.id = ib.book_id
       WHERE f.id = ?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch fine details' });
        if (!row) return res.status(404).json({ error: 'Fine not found' });
        res.json(row);
      }
    );
  });
});

app.get('/api/paypal/client-id', (req, res) => {
  const creds = getPayPalCredentials();
  if (!creds.clientId) {
    return res.status(400).json({ error: 'PayPal is not configured on server. Missing PAYPAL_CLIENT_ID.' });
  }
  return res.json({
    client_id: creds.clientId,
    currency: getPayPalCurrencyCode(),
    server_capture_enabled: Boolean(creds.clientSecret)
  });
});

app.post('/api/fines/:id/paypal/create-order', (req, res) => {
  const { id } = req.params;
  const creds = getPayPalCredentials();

  if (!creds.clientId) {
    return res.status(400).json({ error: 'PayPal is not configured on server. Missing PAYPAL_CLIENT_ID.' });
  }
  if (!creds.clientSecret) {
    return res.status(400).json({ error: 'Server-side PayPal capture is disabled. Configure PAYPAL_CLIENT_SECRET or use client-side capture.' });
  }

  db.get(
    `SELECT id, fine_amount, status
     FROM fines
     WHERE id = ?`,
    [id],
    (err, fineRow) => {
      if (err) return res.status(500).json({ error: 'Failed to load fine details' });
      if (!fineRow) return res.status(404).json({ error: 'Fine not found' });
      if (normalizeStatus(fineRow.status) !== 'pending') {
        return res.status(400).json({ error: 'Fine is already collected' });
      }
      if (Number(fineRow.fine_amount || 0) <= 0) {
        return res.status(400).json({ error: 'Invalid fine amount for payment' });
      }

      createPayPalOrder(Number(fineRow.fine_amount || 0), Number(fineRow.id), (orderErr, order) => {
        if (orderErr) return res.status(500).json({ error: orderErr.message || 'Failed to create PayPal order' });
        return res.json({
          order_id: order.id,
          status: order.status || 'CREATED'
        });
      });
    }
  );
});

app.post('/api/fines/:id/collect', (req, res) => {
  const { id } = req.params;
  const paymentTypeInput = String(req.body?.payment_type || 'Offline').trim().toLowerCase();
  const paymentType = paymentTypeInput === 'online' ? 'Online' : paymentTypeInput === 'offline' ? 'Offline' : null;
  const paymentNotes = String(req.body?.payment_notes || '').trim().slice(0, 200);

  if (!paymentType) {
    return res.status(400).json({ error: 'Payment type must be Online or Offline' });
  }

  db.get(
    `SELECT
       f.id,
       f.issued_book_id,
       f.fine_amount,
       f.status,
       ib.user_id,
       ib.book_id
     FROM fines f
     LEFT JOIN issued_books ib ON ib.id = f.issued_book_id
     WHERE f.id = ?`,
    [id],
    (err, fineRow) => {
      if (err) return res.status(500).json({ error: 'Failed to load fine details' });
      if (!fineRow) return res.status(404).json({ error: 'Fine not found' });
      if (normalizeStatus(fineRow.status) !== 'pending') {
        return res.status(400).json({ error: 'Fine already collected or not found' });
      }

      let transactionId = null;
      let paymentGateway = null;
      let paymentReference = null;

      if (paymentType === 'Online') {
        const orderId = String(req.body?.paypal_order_id || '').trim();
        const paypalClientCaptured = Boolean(req.body?.paypal_captured_on_client);
        const creds = getPayPalCredentials();

        if (!orderId) {
          return res.status(400).json({ error: 'PayPal order id is required for online payment' });
        }

        const savePayPalCollection = (captureId, payerEmail, payerId) => {
          transactionId = captureId || generatePaymentReference('TXN');
          paymentGateway = 'PayPal';
          paymentReference = captureId || orderId;

          const paypalNote = [
            paymentNotes,
            payerEmail ? `PayPal Payer: ${payerEmail}` : '',
            payerId ? `Payer ID: ${payerId}` : ''
          ].filter(Boolean).join(' | ').slice(0, 200);

          db.serialize(() => {
            db.run(
              `UPDATE fines
               SET status = 'Collected',
                   payment_type = ?,
                   payment_reference = ?,
                   payment_notes = ?,
                   collected_at = datetime('now')
               WHERE id = ? AND lower(trim(status)) = 'pending'`,
              [paymentType, paymentReference, paypalNote || null, id],
              function (updateErr) {
                if (updateErr) return res.status(500).json({ error: 'Failed to collect fine' });
                if (this.changes === 0) return res.status(400).json({ error: 'Fine already collected or not found' });

                db.run(
                  `INSERT INTO fine_payments
                     (fine_id, issued_book_id, user_id, book_id, amount, payment_type, payment_status, transaction_id, payment_gateway, payment_reference, payment_notes, paid_at)
                   VALUES
                     (?, ?, ?, ?, ?, ?, 'Success', ?, ?, ?, ?, datetime('now'))`,
                  [
                    fineRow.id,
                    fineRow.issued_book_id,
                    fineRow.user_id || null,
                    fineRow.book_id || null,
                    Number(fineRow.fine_amount || 0),
                    paymentType,
                    transactionId,
                    paymentGateway,
                    paymentReference,
                    paypalNote || null
                  ],
                  function (insertErr) {
                    if (insertErr) return res.status(500).json({ error: 'Fine collected but failed to save payment record' });
                    return res.json({
                      message: 'Fine collected successfully',
                      payment: {
                        payment_id: this.lastID || null,
                        fine_id: fineRow.id,
                        payment_type: paymentType,
                        payment_reference: paymentReference,
                        payment_gateway: paymentGateway,
                        transaction_id: transactionId
                      }
                    });
                  }
                );
              }
            );
          });
        };

        if (creds.clientSecret && !paypalClientCaptured) {
          return capturePayPalOrder(orderId, (captureErr, captureData) => {
            if (captureErr) {
              return res.status(400).json({ error: captureErr.message || 'PayPal capture failed' });
            }

            const purchaseUnit = captureData?.purchase_units?.[0] || null;
            const captureInfo = purchaseUnit?.payments?.captures?.[0] || null;
            if (!captureInfo || String(captureInfo.status || '').toUpperCase() !== 'COMPLETED') {
              return res.status(400).json({ error: 'PayPal payment is not completed' });
            }

            const captureId = String(captureInfo.id || '').trim() || null;
            const payerEmail = String(captureData?.payer?.email_address || '').trim();
            const payerId = String(captureData?.payer?.payer_id || '').trim();
            return savePayPalCollection(captureId, payerEmail, payerId);
          });
        }

        const captureId = String(req.body?.paypal_capture_id || '').trim();
        const payerEmail = String(req.body?.paypal_payer_email || '').trim();
        const payerId = String(req.body?.paypal_payer_id || '').trim();

        if (!captureId) {
          return res.status(400).json({ error: 'PayPal capture id is required for online payment' });
        }
        return savePayPalCollection(captureId, payerEmail, payerId);
      } else {
        paymentGateway = 'Office Counter';
        paymentReference = req.body?.payment_reference
          ? String(req.body.payment_reference).trim().slice(0, 60)
          : generatePaymentReference('OFF');
      }

      db.serialize(() => {
        db.run(
          `UPDATE fines
           SET status = 'Collected',
               payment_type = ?,
               payment_reference = ?,
               payment_notes = ?,
               collected_at = datetime('now')
           WHERE id = ? AND lower(trim(status)) = 'pending'`,
          [paymentType, paymentReference, paymentNotes || null, id],
          function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Failed to collect fine' });
            if (this.changes === 0) return res.status(400).json({ error: 'Fine already collected or not found' });

            db.run(
              `INSERT INTO fine_payments
                 (fine_id, issued_book_id, user_id, book_id, amount, payment_type, payment_status, transaction_id, payment_gateway, payment_reference, payment_notes, paid_at)
               VALUES
                 (?, ?, ?, ?, ?, ?, 'Success', ?, ?, ?, ?, datetime('now'))`,
              [
                fineRow.id,
                fineRow.issued_book_id,
                fineRow.user_id || null,
                fineRow.book_id || null,
                Number(fineRow.fine_amount || 0),
                paymentType,
                transactionId,
                paymentGateway,
                paymentReference,
                paymentNotes || null
              ],
              function (insertErr) {
                if (insertErr) return res.status(500).json({ error: 'Fine collected but failed to save payment record' });
                return res.json({
                  message: 'Fine collected successfully',
                  payment: {
                    payment_id: this.lastID || null,
                    fine_id: fineRow.id,
                    payment_type: paymentType,
                    payment_reference: paymentReference,
                    payment_gateway: paymentGateway
                  }
                });
              }
            );
          }
        );
      });
    }
  );
});

app.get('/api/fine-payments', (req, res) => {
  db.all(
    `SELECT
       fp.id AS payment_id,
       fp.fine_id,
       fp.issued_book_id,
       COALESCE(fp.user_id, ib.user_id) AS user_id,
       COALESCE(fp.book_id, ib.book_id) AS book_id,
       fp.amount,
       fp.payment_type,
       fp.payment_status,
       fp.transaction_id,
       fp.payment_gateway,
       fp.payment_reference,
       fp.payment_notes,
       fp.paid_at,
       COALESCE(u.full_name, 'Unknown User') AS user_name,
       COALESCE(b.book_name, 'Unknown Book') AS book_name
     FROM fine_payments fp
     LEFT JOIN fines f ON f.id = fp.fine_id
     LEFT JOIN issued_books ib ON ib.id = COALESCE(fp.issued_book_id, f.issued_book_id)
     LEFT JOIN users u ON u.id = COALESCE(fp.user_id, ib.user_id)
     LEFT JOIN books b ON b.id = COALESCE(fp.book_id, ib.book_id)
     ORDER BY fp.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch payment records' });
      res.json(rows);
    }
  );
});

// --- CONTACTS API ---

// GET /api/contacts - List all contact messages
app.get('/api/contacts', (req, res) => {
  db.all('SELECT * FROM contact_messages ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    res.json(rows);
  });
});

// POST /api/contacts - Submit a contact message
app.post('/api/contacts', (req, res) => {
  const { name, email, subject, message } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    errors.push('Name must be between 2 and 50 characters');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email is required');
  }
  const validSubjects = ['General', 'Support', 'Feedback', 'Other'];
  if (!subject || !validSubjects.includes(subject)) {
    errors.push('Subject must be General, Support, Feedback, or Other');
  }
  if (!message || message.trim().length < 10 || message.trim().length > 1000) {
    errors.push('Message must be between 10 and 1000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.run(
    'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), subject, message.trim()],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to save message' });
      }
      res.status(201).json({ id: this.lastID, name, email, subject, message });
    }
  );
});

// DELETE /api/contacts/:id - Delete a contact message
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM contact_messages WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete message' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message: 'Message deleted successfully' });
  });
});

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size must be less than 5MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
