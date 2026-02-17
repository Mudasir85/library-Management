const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE = '/mohit';

// In-memory session store: { token: { username, createdAt } }
const sessions = {};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for book image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'book-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype.split('/')[1]);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
    }
  }
});

// Middleware
app.use(express.json());

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
    password TEXT NOT NULL
  )
`);

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
    book_image TEXT,
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
    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({ message: 'Login successful', username });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
});

// GET /api/dashboard/stats - Dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch stats' });
    stats.totalUsers = row.count;

    db.get('SELECT COUNT(*) as count FROM books', [], (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch stats' });
      stats.totalBooks = row2.count;
      res.json(stats);
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

// GET /api/users - List all users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, full_name, email, phone, role FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(rows);
  });
});

// POST /api/users - Add user
app.post('/api/users', (req, res) => {
  const errors = validateUser(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  const { full_name, email, phone, role, password } = req.body;

  db.run(
    'INSERT INTO users (full_name, email, phone, role, password) VALUES (?, ?, ?, ?, ?)',
    [full_name.trim(), email.trim().toLowerCase(), phone.trim(), role, password],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Failed to add user' });
      }
      res.status(201).json({ id: this.lastID, full_name, email, phone, role });
    }
  );
});

// PUT /api/users/:id - Edit user
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const errors = validateUser(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  const { full_name, email, phone, role, password } = req.body;

  db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    let query, params;
    if (password && password.length > 0) {
      query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, password = ? WHERE id = ?';
      params = [full_name.trim(), email.trim().toLowerCase(), phone.trim(), role, password, id];
    } else {
      query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ? WHERE id = ?';
      params = [full_name.trim(), email.trim().toLowerCase(), phone.trim(), role, id];
    }

    db.run(query, params, function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Failed to update user' });
      }
      res.json({ message: 'User updated successfully' });
    });
  });
});

// DELETE /api/users/:id - Delete user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// --- BOOKS API ---

// GET /api/books - List all books
app.get('/api/books', (req, res) => {
  db.all('SELECT * FROM books ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch books' });
    }
    res.json(rows);
  });
});

// POST /api/books - Add a book
app.post('/api/books', upload.single('book_image'), (req, res) => {
  const { book_name, class: bookClass, author_name, publisher_name } = req.body;
  const errors = [];

  if (!book_name || book_name.trim().length < 2 || book_name.trim().length > 100) {
    errors.push('Book Name must be between 2 and 100 characters');
  }
  if (!bookClass || bookClass.trim().length < 1 || bookClass.trim().length > 50) {
    errors.push('Class is required (max 50 characters)');
  }
  if (!author_name || author_name.trim().length < 2 || author_name.trim().length > 100) {
    errors.push('Author Name must be between 2 and 100 characters');
  }
  if (!publisher_name || publisher_name.trim().length < 2 || publisher_name.trim().length > 100) {
    errors.push('Publisher Name must be between 2 and 100 characters');
  }

  if (errors.length > 0) {
    // Clean up uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  const bookImage = req.file ? '/uploads/' + req.file.filename : null;

  db.run(
    'INSERT INTO books (book_name, class, author_name, publisher_name, book_image) VALUES (?, ?, ?, ?, ?)',
    [book_name.trim(), bookClass.trim(), author_name.trim(), publisher_name.trim(), bookImage],
    function (err) {
      if (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Failed to add book' });
      }
      res.status(201).json({
        id: this.lastID,
        book_name: book_name.trim(),
        class: bookClass.trim(),
        author_name: author_name.trim(),
        publisher_name: publisher_name.trim(),
        book_image: bookImage
      });
    }
  );
});

// PUT /api/books/:id - Edit a book
app.put('/api/books/:id', upload.single('book_image'), (req, res) => {
  const { id } = req.params;
  const { book_name, class: bookClass, author_name, publisher_name } = req.body;
  const errors = [];

  if (!book_name || book_name.trim().length < 2 || book_name.trim().length > 100) {
    errors.push('Book Name must be between 2 and 100 characters');
  }
  if (!bookClass || bookClass.trim().length < 1 || bookClass.trim().length > 50) {
    errors.push('Class is required (max 50 characters)');
  }
  if (!author_name || author_name.trim().length < 2 || author_name.trim().length > 100) {
    errors.push('Author Name must be between 2 and 100 characters');
  }
  if (!publisher_name || publisher_name.trim().length < 2 || publisher_name.trim().length > 100) {
    errors.push('Publisher Name must be between 2 and 100 characters');
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

    let bookImage = row.book_image;
    if (req.file) {
      // Delete old image if it exists
      if (row.book_image) {
        const oldPath = path.join(__dirname, 'public', row.book_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      bookImage = '/uploads/' + req.file.filename;
    }

    db.run(
      'UPDATE books SET book_name = ?, class = ?, author_name = ?, publisher_name = ?, book_image = ? WHERE id = ?',
      [book_name.trim(), bookClass.trim(), author_name.trim(), publisher_name.trim(), bookImage, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update book' });
        }
        res.json({ message: 'Book updated successfully' });
      }
    );
  });
});

// DELETE /api/books/:id - Delete a book
app.delete('/api/books/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT book_image FROM books WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Book not found' });

    // Delete associated image file
    if (row.book_image) {
      const imgPath = path.join(__dirname, 'public', row.book_image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.run('DELETE FROM books WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to delete book' });
      res.json({ message: 'Book deleted successfully' });
    });
  });
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
  console.log(`Server running at http://localhost:${PORT}`);
});
