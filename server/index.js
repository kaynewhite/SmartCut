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

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', require('./routes/auth'));
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
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/barber-ratings', require('./routes/barberRatings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

async function runMigrations() {
  const migrations = [
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_points_per_appointment INTEGER DEFAULT 1`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_streak_bonus INTEGER DEFAULT 0`,
    `ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS loyalty_streak_every INTEGER DEFAULT 5`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (err) { console.error('Migration error:', err.message); }
  }
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartCut API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to PostgreSQL', err);
  process.exit(1);
});
