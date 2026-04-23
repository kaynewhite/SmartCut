const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');

// Owner: ban a customer
router.post('/', authenticateBarbershop, async (req, res) => {
  const { customer_id, reason, duration_value, duration_unit } = req.body;
  if (!customer_id) return res.status(400).json({ message: 'customer_id required' });
  try {
    let banned_until = null;
    if (duration_unit && duration_unit !== 'forever' && duration_value) {
      const map = { day: 'days', days: 'days', week: 'weeks', weeks: 'weeks', month: 'months', months: 'months' };
      const unit = map[duration_unit] || 'days';
      const result = await pool.query(`SELECT NOW() + ($1 || ' ' || $2)::interval as until`, [duration_value, unit]);
      banned_until = result.rows[0].until;
    }
    const result = await pool.query(
      'INSERT INTO customer_bans (customer_id, barbershop_id, reason, banned_until) VALUES ($1,$2,$3,$4) RETURNING *',
      [customer_id, req.user.id, reason || 'No reason provided', banned_until]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Owner: list active bans
router.get('/', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cb.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM customer_bans cb LEFT JOIN customers c ON c.id = cb.customer_id
      WHERE cb.barbershop_id = $1 AND (cb.banned_until IS NULL OR cb.banned_until > NOW())
      ORDER BY cb.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Owner: unban
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_bans WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
