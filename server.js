const express = require('express');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'users.db');

const db = new sqlite3.Database(DB_PATH);

const ALLOWED_ROLES = ['Admin', 'User', 'Guest'];
const ALLOWED_ROLE_SET = new Set(ALLOWED_ROLES);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const AUTH_USERNAME = process.env.LIBRARY_ADMIN_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.LIBRARY_ADMIN_PASSWORD || 'password123';
const SESSION_COOKIE_NAME = 'library_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const CREATE_USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 2 AND 50),
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL CHECK(length(phone) = 10),
    role TEXT NOT NULL CHECK(role IN ('Admin', 'User', 'Guest')),
    password TEXT NOT NULL CHECK(length(password) >= 8)
  )
`;

const sessions = new Map();

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex < 0) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getValidSession(token) {
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function clearSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  const session = getValidSession(token);
  return { token, session };
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function requirePageAuth(req, res, next) {
  const { session } = getSessionFromRequest(req);
  if (!session) {
    res.redirect('/login');
    return;
  }

  req.session = session;
  next();
}

function requireApiAuth(req, res, next) {
  const { session } = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ message: 'Unauthorized. Please login first.' });
    return;
  }

  req.session = session;
  next();
}

async function initDb() {
  await run(CREATE_USERS_TABLE_SQL);
}

function validateUserInput(input, isEdit = false) {
  const errors = [];
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const role = typeof input.role === 'string' ? input.role.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (fullName.length < 2 || fullName.length > 50) {
    errors.push('Full Name must be 2 to 50 characters.');
  }

  if (!EMAIL_REGEX.test(email)) {
    errors.push('Email must be a valid email address.');
  }

  if (!PHONE_REGEX.test(phone)) {
    errors.push('Phone must be exactly 10 digits.');
  }

  if (!ALLOWED_ROLE_SET.has(role)) {
    errors.push('Role must be Admin, User, or Guest.');
  }

  if (!isEdit || password.length > 0) {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters.');
    }
  }

  return {
    errors,
    value: { fullName, email, phone, role, password }
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    res.status(400).json({ message: 'Invalid JSON payload.' });
    return;
  }
  next(error);
});

app.get('/login', (req, res) => {
  const { session } = getSessionFromRequest(req);
  if (session) {
    res.redirect('/');
    return;
  }

  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required.' });
    return;
  }

  if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
    res.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  const token = createSession(username);
  setSessionCookie(res, token);
  res.json({ message: 'Login successful.', user: { username } });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = getSessionFromRequest(req);
  clearSession(token);
  clearSessionCookie(res);
  res.json({ message: 'Logout successful.' });
});

app.get('/api/auth/session', (req, res) => {
  const { session } = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true, user: { username: session.username } });
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/user-details/:id', requirePageAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).send('Invalid user id.');
    return;
  }

  res.sendFile(path.join(__dirname, 'public', 'user-details.html'));
});

app.get(['/api/users', '/users'], requireApiAuth, async (req, res) => {
  try {
    const users = await all(
      'SELECT id, full_name, email, phone, role FROM users ORDER BY id DESC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

app.get('/api/users/:id', requireApiAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid user id.' });
    return;
  }

  try {
    const user = await get(
      'SELECT id, full_name, email, phone, role, password FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user details.' });
  }
});

app.post(['/api/users', '/users'], requireApiAuth, async (req, res) => {
  const { errors, value } = validateUserInput(req.body, false);
  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(' ') });
    return;
  }

  try {
    const existing = await get('SELECT id FROM users WHERE email = ?', [value.email]);
    if (existing) {
      res.status(409).json({ message: 'Email already exists.' });
      return;
    }

    const result = await run(
      'INSERT INTO users (full_name, email, phone, role, password) VALUES (?, ?, ?, ?, ?)',
      [value.fullName, value.email, value.phone, value.role, value.password]
    );

    const user = await get(
      'SELECT id, full_name, email, phone, role FROM users WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(user);
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ message: 'Email already exists.' });
      return;
    }
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

app.put(['/api/users/:id', '/users/:id'], requireApiAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid user id.' });
    return;
  }

  const { errors, value } = validateUserInput(req.body, true);
  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(' ') });
    return;
  }

  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const existingEmailUser = await get(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [value.email, id]
    );

    if (existingEmailUser) {
      res.status(409).json({ message: 'Email already exists.' });
      return;
    }

    const nextPassword = value.password.length > 0 ? value.password : user.password;

    await run(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, password = ? WHERE id = ?',
      [value.fullName, value.email, value.phone, value.role, nextPassword, id]
    );

    const updated = await get(
      'SELECT id, full_name, email, phone, role FROM users WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

app.delete(['/api/users/:id', '/users/:id'], requireApiAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid user id.' });
    return;
  }

  try {
    const user = await get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    await run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running at http://localhost:${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`Login with username "${AUTH_USERNAME}" and password "${AUTH_PASSWORD}"`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
