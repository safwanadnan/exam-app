const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

async function seed() {
    const dbPath = path.resolve(__dirname, 'dev.db');
    console.log('Connecting to:', dbPath);
    const db = new Database(dbPath);

    try {
        const password = await bcrypt.hash('admin123', 10);
        const email = 'admin@example.com';
        const name = 'University Admin';
        const role = 'ADMIN';
        const now = new Date().toISOString();

        // Check if user exists
        const existing = db.prepare('SELECT id FROM User WHERE email = ?').get(email);

        if (existing) {
            console.log('User already exists, updating password and role...');
            db.prepare('UPDATE User SET hashedPassword = ?, role = ?, updatedAt = ? WHERE email = ?')
                .run(password, role, now, email);
        } else {
            console.log('Creating new admin user...');
            const id = 'seed-admin-' + Math.random().toString(36).substring(7);
            db.prepare('INSERT INTO User (id, email, name, role, hashedPassword, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(id, email, name, role, password, now, now);
        }

        console.log('Seed successful! Email: admin@example.com, Password: admin123');
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        db.close();
    }
}

seed();
