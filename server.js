const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

  // Check if user exists
  db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query based on whether password is provided
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
