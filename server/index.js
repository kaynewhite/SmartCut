require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

pool.query('SELECT NOW()').then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartCut API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to PostgreSQL', err);
  process.exit(1);
});
