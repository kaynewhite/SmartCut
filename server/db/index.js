const { Pool } = require('pg');

// NEON_DATABASE_URL takes priority over the Replit-managed DATABASE_URL
const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';

// Strip unsupported channel_binding param that Neon includes but node-pg ignores
const connectionString = rawUrl
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/[&?]$/, '')
  .replace(/\?$/, '');

const isNeon = connectionString.includes('neon.tech');

const pool = new Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err.message);
});

module.exports = pool;
