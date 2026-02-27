const Database = require('better-sqlite3');
const path = require('path');

try {
    const dbPath = path.resolve(__dirname, 'dev.db');
    console.log('Opening database at:', dbPath);
    const db = new Database(dbPath, { verbose: console.log });

    const users = db.prepare('SELECT count(*) as count FROM User').get();
    console.log('User count:', users.count);

    db.close();
    console.log('Database test successful!');
} catch (err) {
    console.error('Database test failed:', err);
}
