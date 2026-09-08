const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      `SELECT * FROM notifications WHERE recipient_type = $1 AND recipient_id = $2 ORDER BY created_at DESC LIMIT 50`,
      [decoded.type, decoded.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.patch('/:id/read', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_type = $2 AND recipient_id = $3',
      [req.params.id, decoded.type, decoded.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.patch('/read-all', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    await pool.query('UPDATE notifications SET is_read = true WHERE recipient_type = $1 AND recipient_id = $2',
      [decoded.type, decoded.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
