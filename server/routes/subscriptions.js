const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticate, authenticateCustomer, authenticateBarbershop } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `sub_proof_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Check own subscription status
router.get('/status', authenticate, async (req, res) => {
  try {
    const { type, id } = req.user;
    if (!['customer', 'barbershop'].includes(type)) return res.json({ status: 'n/a' });
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE subscriber_type=$1 AND subscriber_id=$2 ORDER BY created_at DESC LIMIT 1`,
      [type, id]
    );
    const table = type === 'barbershop' ? 'barbershops' : 'customers';
    const userRow = await pool.query(`SELECT subscription_status FROM ${table} WHERE id=$1`, [id]);
    res.json({
      subscription: result.rows[0] || null,
      is_active: userRow.rows[0]?.subscription_status === 'active'
    });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Submit subscription request with payment proof
router.post('/request', authenticate, upload.single('proof'), async (req, res) => {
  try {
    const { type, id } = req.user;
    if (!['customer', 'barbershop'].includes(type)) return res.status(403).json({ message: 'Not applicable' });
    if (!req.file) return res.status(400).json({ message: 'Payment proof required' });
    const pending = await pool.query(
      `SELECT id FROM subscriptions WHERE subscriber_type=$1 AND subscriber_id=$2 AND status='pending'`,
      [type, id]
    );
    if (pending.rows.length) return res.status(400).json({ message: 'You already have a pending subscription request' });
    const url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `INSERT INTO subscriptions (subscriber_type, subscriber_id, payment_proof_url) VALUES ($1,$2,$3) RETURNING *`,
      [type, id, url]
    );
    const admins = await pool.query('SELECT id FROM admins LIMIT 5');
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('admin',$1,'New Subscription Request',$2,'subscription')`,
        [admin.id, `A ${type} has submitted a subscription payment proof for review.`]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
