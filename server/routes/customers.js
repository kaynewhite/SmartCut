const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// Get customer profile
router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, loyalty_points, rating, no_show_count, created_at FROM customers WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer profile
router.put('/me', authenticateCustomer, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE customers SET name=COALESCE($1,name), phone=COALESCE($2,phone) WHERE id=$3 RETURNING id, name, email, phone, loyalty_points, rating',
      [name, phone, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get haircut history
router.get('/me/history', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, b.name as barbershop_name, b.logo_url as barbershop_logo, b.address as barbershop_address,
              bar.name as barber_name, s.name as service_name, s.price,
              r.barbershop_rating, r.barber_rating, r.comment as review
       FROM appointments a
       JOIN barbershops b ON b.id = a.barbershop_id
       LEFT JOIN barbers bar ON bar.id = a.barber_id
       JOIN services s ON s.id = a.service_id
       LEFT JOIN ratings r ON r.appointment_id = a.id AND r.customer_id = a.customer_id
       WHERE a.customer_id = $1 AND a.status = 'completed'
       ORDER BY a.appointment_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get loyalty points history
router.get('/me/loyalty', authenticateCustomer, async (req, res) => {
  try {
    const points = await pool.query('SELECT loyalty_points FROM customers WHERE id=$1', [req.user.id]);
    const history = await pool.query(
      'SELECT * FROM loyalty_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ total_points: points.rows[0].loyalty_points, history: history.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
