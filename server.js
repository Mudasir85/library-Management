const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'users.db');

const db = new sqlite3.Database(DB_PATH);

const ALLOWED_ROLES = ['Admin', 'User', 'Guest'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const CREATE_USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    password TEXT NOT NULL
  )
`;

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

  if (!ALLOWED_ROLES.includes(role)) {
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
app.use(express.static(path.join(__dirname, 'public')));

app.get(['/api/users', '/users'], async (req, res) => {
  try {
    const users = await all(
      'SELECT id, full_name, email, phone, role FROM users ORDER BY id DESC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

app.post(['/api/users', '/users'], async (req, res) => {
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

app.put(['/api/users/:id', '/users/:id'], async (req, res) => {
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

app.delete(['/api/users/:id', '/users/:id'], async (req, res) => {
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
