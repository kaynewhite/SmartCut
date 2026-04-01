const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// Customer Registration
router.post('/customer/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM customers WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO customers (name, email, password, phone) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, loyalty_points, rating',
      [name, email, hash, phone || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, type: 'customer', email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, type: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Customer Login
router.post('/customer/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM customers WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, type: 'customer', email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userSafe } = user;
    res.json({ token, user: { ...userSafe, type: 'customer' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Barbershop Registration
router.post('/barbershop/register', async (req, res) => {
  const { name, email, password, phone, address, city, description } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM barbershops WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO barbershops (name, email, password, phone, address, city, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, phone, address, city, description, is_active',
      [name, email, hash, phone || null, address || null, city || null, description || null]
    );
    const shop = result.rows[0];
    const token = jwt.sign({ id: shop.id, type: 'barbershop', email: shop.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...shop, type: 'barbershop' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Barbershop Login
router.post('/barbershop/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const shop = result.rows[0];
    const valid = await bcrypt.compare(password, shop.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: shop.id, type: 'barbershop', email: shop.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...shopSafe } = shop;
    res.json({ token, user: { ...shopSafe, type: 'barbershop' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
