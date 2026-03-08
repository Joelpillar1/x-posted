import Database from 'better-sqlite3';

const db = new Database('app.db', { verbose: console.log });

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    twitter_id TEXT UNIQUE,
    username TEXT,
    name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    brand_analysis TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    scheduled_for DATETIME,
    status TEXT DEFAULT 'draft',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export default db;
