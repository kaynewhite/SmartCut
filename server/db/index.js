const { Pool } = require('pg');

const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';

if (!rawUrl) {
  console.error('NEON_DATABASE_URL is not set. Please provide a PostgreSQL connection string.');
}

// Strip unsupported channel_binding param (not supported by node-postgres) and clean up
const connectionString = rawUrl
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/[&?]$/, '')
  .replace(/\?$/, '');

const isNeon = !!process.env.NEON_DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

module.exports = pool;
