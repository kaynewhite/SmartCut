const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, avatar_url, loyalty_points, rating, no_show_count FROM customers WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/me', authenticateCustomer, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name = $1, phone = $2 WHERE id = $3 RETURNING id, name, email, phone, loyalty_points, rating`,
      [name, phone || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/me/loyalty', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
