// Quick database test
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Testing database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  }
  console.log('✅ Database opened successfully');
  
  db.get("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1", (err, row) => {
    if (err) {
      console.error('❌ Query error:', err.message);
      process.exit(1);
    }
    console.log('✅ Database query successful');
    console.log('✅ Sample table:', row ? row.name : 'No tables');
    db.close();
  });
});
