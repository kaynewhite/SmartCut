const { Pool } = require('pg');

const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';

// Strip unsupported channel_binding param and clean up
const connectionString = rawUrl
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/[&?]$/, '')
  .replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  // Always disable cert verification — works for both Replit-managed DB and Neon
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

module.exports = pool;
