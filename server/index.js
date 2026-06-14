require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Simple in-memory rate limiter (no external packages needed)
const rateLimits = new Map();
setInterval(() => rateLimits.clear(), 60 * 1000);

function rateLimit(maxPerMinute) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const count = (rateLimits.get(key) || 0) + 1;
    rateLimits.set(key, count);
    if (count > maxPerMinute) {
      return res.status(429).json({ message: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

// Rate-limited routes
app.use('/api/auth', rateLimit(20), require('./routes/auth'));
app.use('/api/subscriptions', rateLimit(30), require('./routes/subscriptions'));

app.use('/api/barbershops', require('./routes/barbershops'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));
app.use('/api/bans', require('./routes/bans'));
app.use('/api/customer-ratings', require('./routes/customerRatings'));
app.use('/api/loyalty-promos', require('./routes/loyaltyPromos'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/barber-ratings', require('./routes/barberRatings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Global multer error handler
app.use((err, req, res, next) => {
  if (err && err.message && (err.message.includes('Only image') || err.code === 'LIMIT_FILE_SIZE')) {
    return res.status(400).json({ message: err.message || 'File upload error' });
  }
  next(err);
});

async function runMigrations() {
  const migrations = [
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_points_per_appointment INTEGER DEFAULT 1`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_streak_bonus INTEGER DEFAULT 0`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_streak_every INTEGER DEFAULT 5`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS restriction_reason TEXT`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS restriction_requirements TEXT`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS appeal_text TEXT`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS appeal_status TEXT DEFAULT 'none'`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMP`,
    `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS loyalty_awarded BOOLEAN DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS promo_redemptions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      promo_id INTEGER NOT NULL,
      barbershop_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      redemption_code TEXT,
      status TEXT DEFAULT 'pending',
      appointment_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `ALTER TABLE promo_redemptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`,
    `ALTER TABLE promo_redemptions ADD COLUMN IF NOT EXISTS appointment_id INTEGER`,
    `ALTER TABLE loyalty_promos ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (err) { console.error('Migration error:', err.message); }
  }
}

// Auto-expire subscriptions whose expires_at has passed
async function expireSubscriptions() {
  try {
    const expired = await pool.query(
      `SELECT s.id, s.subscriber_type, s.subscriber_id
       FROM subscriptions s
       WHERE s.status = 'active' AND s.expires_at IS NOT NULL AND s.expires_at < NOW()`
    );
    for (const s of expired.rows) {
      await pool.query(`UPDATE subscriptions SET status='expired' WHERE id=$1`, [s.id]);
      const table = s.subscriber_type === 'barbershop' ? 'barbershops' : 'customers';
      await pool.query(`UPDATE ${table} SET subscription_status='inactive' WHERE id=$1`, [s.subscriber_id]);
    }
    if (expired.rows.length > 0) console.log(`Expired ${expired.rows.length} subscription(s)`);
  } catch (err) { console.error('Expiry job error:', err.message); }
}

async function seedAdmin() {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@smartcut.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin@SmartCut2024';
    const existing = await pool.query('SELECT id FROM admins WHERE email=$1', [email]);
    if (!existing.rows.length) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO admins (name, email, password) VALUES ($1,$2,$3)', ['Admin', email, hash]);
      console.log(`Admin account created: ${email}`);
    }
  } catch (err) { console.error('Admin seed error:', err.message); }
}

pool.query('SELECT NOW()').then(async () => {
  await runMigrations();
  await seedAdmin();
  await expireSubscriptions();
  setInterval(expireSubscriptions, 60 * 60 * 1000); // check every hour
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartCut API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to PostgreSQL', err);
  process.exit(1);
});
