const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = (text, params) => pool.query(text, params);

async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { await pool.query('SELECT 1'); return; } catch (e) {
      console.log(`[db] waiting for PostgreSQL (${i + 1}/${retries}) ${e.code || e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('PostgreSQL unavailable. Check DATABASE_URL.');
}
async function migrate() {
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
}
module.exports = { pool, query, waitForDb, migrate };
