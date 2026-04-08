const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { collection, formatDoc } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// Customer Registration
router.post('/customer/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const customers = await collection('customers');
    const existing = await customers.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const userDoc = {
      name,
      email,
      password: hash,
      phone: phone || null,
      loyalty_points: 0,
      rating: 0,
      no_show_count: 0,
      created_at: new Date()
    };
    const result = await customers.insertOne(userDoc);
    const user = { ...userDoc, id: result.insertedId.toString() };
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
    const customers = await collection('customers');
    const user = await customers.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id.toString(), type: 'customer', email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userSafe } = user;
    res.json({ token, user: { ...formatDoc(userSafe), type: 'customer' } });
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
    const shops = await collection('barbershops');
    const existing = await shops.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const shopDoc = {
      name,
      email,
      password: hash,
      phone: phone || null,
      address: address || null,
      city: city || null,
      description: description || null,
      is_active: true,
      created_at: new Date()
    };
    const result = await shops.insertOne(shopDoc);
    const shop = { ...shopDoc, id: result.insertedId.toString() };
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
    const shops = await collection('barbershops');
    const shop = await shops.findOne({ email });
    if (!shop) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, shop.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: shop._id.toString(), type: 'barbershop', email: shop.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...shopSafe } = shop;
    res.json({ token, user: { ...formatDoc(shopSafe), type: 'barbershop' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
