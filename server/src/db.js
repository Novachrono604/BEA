import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.join(dataDir, 'marketplace.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, college TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, author TEXT DEFAULT '', subject TEXT NOT NULL, branch TEXT NOT NULL,
 semester INTEGER NOT NULL, price REAL NOT NULL CHECK(price >= 0), condition TEXT NOT NULL,
 description TEXT DEFAULT '', image_url TEXT DEFAULT '', status TEXT DEFAULT 'available',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL REFERENCES listings(id),
 buyer_id INTEGER NOT NULL REFERENCES users(id), message TEXT DEFAULT '',
 status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(listing_id, buyer_id)
);
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL REFERENCES listings(id),
 sender_id INTEGER NOT NULL REFERENCES users(id), receiver_id INTEGER NOT NULL REFERENCES users(id),
 body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (!count) {
 const hash = bcrypt.hashSync('DemoPass123!', 10);
 const u = db.prepare('INSERT INTO users(name,email,password_hash,college) VALUES(?,?,?,?)').run('Demo Student','demo@campusbooks.local',hash,'BMS Institute of Technology');
 const add = db.prepare(`INSERT INTO listings(user_id,title,author,subject,branch,semester,price,condition,description,image_url)
 VALUES(?,?,?,?,?,?,?,?,?,?)`);
 [
 ['Engineering Mathematics I','B.S. Grewal','Mathematics','CSE',1,180,'Good','Some pencil notes, no missing pages.',''],
 ['Data Structures and Algorithms','Narasimha Karumanchi','Data Structures','CSE',3,250,'Very good','Popular interview prep text. Clean pages.',''],
 ['Database System Concepts','Silberschatz, Korth','DBMS','ISE',4,320,'Good','Includes handwritten revision notes.',''],
 ['Operating System Concepts','Silberschatz, Galvin','Operating Systems','CSE',5,280,'Like new','Barely used, no highlighting.',''],
 ['Engineering Physics','H.K. Malik','Physics','ECE',1,120,'Fair','A few highlighted pages, fully usable.','']
 ].forEach(x=>add.run(u.lastInsertRowid,...x));
}
