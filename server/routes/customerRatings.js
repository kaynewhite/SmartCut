const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarber } = require('../middleware/auth');

// Barber: rate a customer (especially after no-show)
router.post('/', authenticateBarber, async (req, res) => {
  const { customer_id, appointment_id, rating, comment } = req.body;
  if (!customer_id || !appointment_id || !rating) return res.status(400).json({ message: 'customer_id, appointment_id, and rating are required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });
  try {
    const appt = await pool.query(
      'SELECT * FROM appointments WHERE id=$1 AND barber_id=$2 AND status=$3',
      [appointment_id, req.user.id, 'completed']
    );
    if (!appt.rows.length) return res.status(403).json({ message: 'Can only rate customers from completed appointments' });

    const existing = await pool.query(
      'SELECT id FROM customer_ratings WHERE barber_id=$1 AND appointment_id=$2',
      [req.user.id, appointment_id]
    );
    if (existing.rows.length) return res.status(400).json({ message: 'Already rated this customer for this appointment' });

    const result = await pool.query(
      `INSERT INTO customer_ratings (customer_id, barber_id, barbershop_id, appointment_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [customer_id, req.user.id, req.user.barbershop_id, appointment_id, rating, comment || null]
    );

    const avg = await pool.query('SELECT AVG(rating)::numeric(3,2) as a FROM customer_ratings WHERE customer_id = $1', [customer_id]);
    await pool.query('UPDATE customers SET rating = $1 WHERE id = $2', [avg.rows[0].a || 5.0, customer_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Get customer ratings (for barber viewing a customer)
router.get('/customer/:id', authenticateBarber, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, b.name as barber_name FROM customer_ratings cr
      LEFT JOIN barbers b ON b.id = cr.barber_id
      WHERE cr.customer_id = $1 AND cr.barber_id = $2 ORDER BY cr.created_at DESC LIMIT 30
    `, [req.params.id, req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
