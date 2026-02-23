const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function all(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function ensureColumn(table, columnName, alterSql) {
  const columns = await all(`PRAGMA table_info(${table})`);
  const names = columns.map((c) => c.name);
  if (!names.includes(columnName)) {
    await run(alterSql);
  }
}

async function migrate() {
  await run(`
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

  await ensureColumn('users', 'created_at', 'ALTER TABLE users ADD COLUMN created_at DATETIME');
  await ensureColumn('users', 'profile_image', 'ALTER TABLE users ADD COLUMN profile_image TEXT');
  await run('UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL');

  await run(`
    CREATE TABLE IF NOT EXISTS class_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
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
  await ensureColumn('book_master', 'total_copies', 'ALTER TABLE book_master ADD COLUMN total_copies INTEGER NOT NULL DEFAULT 1');

  await run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('books', 'total_copies', 'ALTER TABLE books ADD COLUMN total_copies INTEGER NOT NULL DEFAULT 1');
  await ensureColumn('books', 'available_copies', 'ALTER TABLE books ADD COLUMN available_copies INTEGER NOT NULL DEFAULT 1');
  await ensureColumn('books', 'isbn', 'ALTER TABLE books ADD COLUMN isbn TEXT');
  await ensureColumn('books', 'book_master_id', 'ALTER TABLE books ADD COLUMN book_master_id INTEGER');
  await ensureColumn('books', 'class_master_id', 'ALTER TABLE books ADD COLUMN class_master_id INTEGER');

  await run(`
    INSERT OR IGNORE INTO class_master (class_name)
    SELECT DISTINCT class FROM books WHERE class IS NOT NULL AND trim(class) <> ''
  `);

  await run(`
    INSERT OR IGNORE INTO book_master (book_name, author_name, publisher_name, isbn, total_copies)
    SELECT DISTINCT book_name, author_name, publisher_name, isbn, COALESCE(total_copies, 1)
    FROM books
    WHERE book_name IS NOT NULL AND author_name IS NOT NULL AND publisher_name IS NOT NULL
  `);

  await run(`
    UPDATE books
    SET class_master_id = (
      SELECT cm.id FROM class_master cm WHERE cm.class_name = books.class
    )
    WHERE class_master_id IS NULL
  `);

  await run(`
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

  await run(`
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

  const issuedColumns = await all('PRAGMA table_info(issued_books)');
  const issuedNames = issuedColumns.map((c) => c.name);
  if (!issuedNames.includes('due_date')) {
    await run('ALTER TABLE issued_books ADD COLUMN due_date DATETIME');
    await run("UPDATE issued_books SET due_date = datetime(issue_date, '+14 days') WHERE due_date IS NULL");
  }

  await run(`
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
  await ensureColumn('fines', 'payment_type', 'ALTER TABLE fines ADD COLUMN payment_type TEXT');
  await ensureColumn('fines', 'payment_reference', 'ALTER TABLE fines ADD COLUMN payment_reference TEXT');
  await ensureColumn('fines', 'payment_notes', 'ALTER TABLE fines ADD COLUMN payment_notes TEXT');
  await run("UPDATE fines SET payment_type = 'Offline' WHERE lower(trim(status)) = 'collected' AND (payment_type IS NULL OR trim(payment_type) = '')");

  await run(`
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
}

migrate()
  .then(() => {
    console.log('Migration completed successfully.');
    db.close();
  })
  .catch((err) => {
    console.error('Migration failed:', err.message);
    db.close(() => process.exit(1));
  });
