const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const sign = (id, type, extra = {}) => jwt.sign({ id, type, ...extra }, JWT_SECRET, { expiresIn: '30d' });

router.post('/customer/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(400).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO customers (name, email, password, phone) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, loyalty_points, rating, subscription_status',
      [name, email.toLowerCase(), hash, phone || null]
    );
    const user = result.rows[0];
    const token = sign(user.id, 'customer', { name: user.name, email: user.email });
    res.status(201).json({ token, user: { ...user, type: 'customer' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/customer/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign(user.id, 'customer', { name: user.name, email: user.email });
    delete user.password;
    res.json({ token, user: { ...user, type: 'customer' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/barbershop/register', async (req, res) => {
  const { name, email, password, phone, address, city, description } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM barbershops WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(400).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO barbershops (name, email, password, phone, address, city, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, phone, address, city, description, subscription_status`,
      [name, email.toLowerCase(), hash, phone || null, address || null, city || null, description || null]
    );
    const shop = result.rows[0];
    const token = sign(shop.id, 'barbershop', { name: shop.name, email: shop.email });
    res.status(201).json({ token, user: { ...shop, type: 'barbershop' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/barbershop/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const shop = result.rows[0];
    const match = await bcrypt.compare(password, shop.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign(shop.id, 'barbershop', { name: shop.name, email: shop.email });
    delete shop.password;
    res.json({ token, user: { ...shop, type: 'barbershop' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/barber/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM barbers WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const barber = result.rows[0];
    if (!barber.password) return res.status(401).json({ message: 'Account not activated. Contact your barbershop owner.' });
    const match = await bcrypt.compare(password, barber.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign(barber.id, 'barber', { name: barber.name, barbershop_id: barber.barbershop_id });
    delete barber.password;
    res.json({ token, user: { ...barber, type: 'barber' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = sign(admin.id, 'admin', { name: admin.name, email: admin.email });
    delete admin.password;
    res.json({ token, user: { ...admin, type: 'admin' } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const tableMap = { customer: 'customers', barber: 'barbers', barbershop: 'barbershops', admin: 'admins' };
    const table = tableMap[decoded.type];
    if (!table) return res.status(400).json({ message: 'Unknown type' });
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [decoded.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    const user = result.rows[0];
    delete user.password;
    res.json({ ...user, type: decoded.type });
  } catch { res.status(401).json({ message: 'Invalid token' }); }
});

module.exports = router;
