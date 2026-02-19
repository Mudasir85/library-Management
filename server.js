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
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add total_copies and available_copies columns if they don't exist (for existing databases)
db.all("PRAGMA table_info(books)", [], (err, columns) => {
  if (err) return;
  const colNames = columns.map(c => c.name);
  if (!colNames.includes('total_copies')) {
    db.run("ALTER TABLE books ADD COLUMN total_copies INTEGER NOT NULL DEFAULT 1");
  }
  if (!colNames.includes('available_copies')) {
    db.run("ALTER TABLE books ADD COLUMN available_copies INTEGER NOT NULL DEFAULT 1");
  }
});

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
db.all("PRAGMA table_info(issued_books)", [], (err, columns) => {
  if (err) return;
  const colNames = columns.map(c => c.name);
  if (!colNames.includes('due_date')) {
    db.run("ALTER TABLE issued_books ADD COLUMN due_date DATETIME");
    // Set due_date for existing records that don't have it (14 days from issue_date)
    db.run("UPDATE issued_books SET due_date = datetime(issue_date, '+14 days') WHERE due_date IS NULL");
  }
});

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

      db.get("SELECT COUNT(*) as count FROM issued_books WHERE status = 'Issued'", [], (err3, row3) => {
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
  db.all('SELECT * FROM books ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch books' });
    }
    res.json(rows);
  });
});

// POST /api/books - Add a book
app.post('/api/books', upload.single('book_image'), (req, res) => {
  const { book_name, class: bookClass, author_name, publisher_name, total_copies } = req.body;
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

  const copies = parseInt(total_copies) || 1;
  if (copies < 1 || copies > 9999) {
    errors.push('Total Copies must be between 1 and 9999');
  }

  if (errors.length > 0) {
    // Clean up uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: errors.join(', ') });
  }

  const bookImage = req.file ? '/uploads/' + req.file.filename : null;

  db.run(
    'INSERT INTO books (book_name, class, author_name, publisher_name, book_image, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [book_name.trim(), bookClass.trim(), author_name.trim(), publisher_name.trim(), bookImage, copies, copies],
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
        book_image: bookImage,
        total_copies: copies,
        available_copies: copies
      });
    }
  );
});

// PUT /api/books/:id - Edit a book
app.put('/api/books/:id', upload.single('book_image'), (req, res) => {
  const { id } = req.params;
  const { book_name, class: bookClass, author_name, publisher_name, total_copies } = req.body;
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

  const newTotalCopies = parseInt(total_copies);
  if (total_copies !== undefined && total_copies !== '' && (isNaN(newTotalCopies) || newTotalCopies < 1 || newTotalCopies > 9999)) {
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

    let bookImage = row.book_image;
    if (req.file) {
      // Delete old image if it exists
      if (row.book_image) {
        const oldPath = path.join(__dirname, 'public', row.book_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      bookImage = '/uploads/' + req.file.filename;
    }

    // Calculate new available_copies based on total_copies change
    let updatedTotalCopies = row.total_copies || 1;
    let updatedAvailableCopies = row.available_copies || 0;
    if (!isNaN(newTotalCopies) && newTotalCopies >= 1) {
      const issuedCount = updatedTotalCopies - updatedAvailableCopies;
      updatedTotalCopies = newTotalCopies;
      updatedAvailableCopies = Math.max(0, newTotalCopies - issuedCount);
    }

    db.run(
      'UPDATE books SET book_name = ?, class = ?, author_name = ?, publisher_name = ?, book_image = ?, total_copies = ?, available_copies = ? WHERE id = ?',
      [book_name.trim(), bookClass.trim(), author_name.trim(), publisher_name.trim(), bookImage, updatedTotalCopies, updatedAvailableCopies, id],
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

  // Check if book has any active issues
  db.get("SELECT COUNT(*) as count FROM issued_books WHERE book_id = ? AND status = 'Issued'", [id], (err, issueRow) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (issueRow && issueRow.count > 0) {
      return res.status(400).json({ error: 'Cannot delete book. It has ' + issueRow.count + ' active issue(s). Return all copies first.' });
    }

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
  const summary = {};
  db.get("SELECT COUNT(*) as count FROM issued_books WHERE status = 'Issued'", [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch summary' });
    summary.totalIssued = row ? row.count : 0;

    db.get("SELECT COUNT(*) as count FROM issued_books WHERE status = 'Returned'", [], (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch summary' });
      summary.totalReturned = row2 ? row2.count : 0;

      db.get("SELECT COUNT(*) as count FROM issued_books WHERE status = 'Issued' AND due_date < datetime('now')", [], (err3, row3) => {
        if (err3) return res.status(500).json({ error: 'Failed to fetch summary' });
        summary.totalOverdue = row3 ? row3.count : 0;

        res.json(summary);
      });
    });
  });
});

// POST /api/issued-books - Issue a book
app.post('/api/issued-books', (req, res) => {
  const { book_id, user_id } = req.body;
  const errors = [];

  if (!book_id) errors.push('Book is required');
  if (!user_id) errors.push('User is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
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

        // Issue the book - set issue_date to today and due_date to 14 days from today
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 14);
        const issueDateStr = today.toISOString().slice(0, 19).replace('T', ' ');
        const dueDateStr = dueDate.toISOString().slice(0, 19).replace('T', ' ');

        db.run('INSERT INTO issued_books (book_id, user_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)', [book_id, user_id, issueDateStr, dueDateStr, 'Issued'], function(err) {
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

  db.get('SELECT * FROM issued_books WHERE id = ?', [id], (err, issued) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!issued) return res.status(404).json({ error: 'Issued record not found' });
    if (issued.status === 'Returned') {
      return res.status(400).json({ error: 'This book has already been returned' });
    }

    db.run('UPDATE issued_books SET status = ?, return_date = CURRENT_TIMESTAMP WHERE id = ?', ['Returned', id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to return book' });

      db.run('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [issued.book_id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update book availability' });

        res.json({ message: 'Book returned successfully' });
      });
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
