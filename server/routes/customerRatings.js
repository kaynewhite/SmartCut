const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershopOrBarber } = require('../middleware/auth');

// Barber/Owner: rate a customer (especially after no-show)
router.post('/', authenticateBarbershopOrBarber, async (req, res) => {
  const { customer_id, appointment_id, barber_id, rating, comment } = req.body;
  if (!customer_id || !rating) return res.status(400).json({ message: 'Missing fields' });
  try {
    const barbershop_id = req.user.type === 'barbershop' ? req.user.id : req.user.barbershop_id;
    const result = await pool.query(
      `INSERT INTO customer_ratings (customer_id, barber_id, barbershop_id, appointment_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [customer_id, barber_id || (req.user.type === 'barber' ? req.user.id : null), barbershop_id, appointment_id || null, rating, comment || null]
    );
    // update customer's overall rating average
    const avg = await pool.query('SELECT AVG(rating)::numeric(3,2) as a FROM customer_ratings WHERE customer_id = $1', [customer_id]);
    await pool.query('UPDATE customers SET rating = $1 WHERE id = $2', [avg.rows[0].a || 5.0, customer_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Get customer ratings (for owner viewing a customer)
router.get('/customer/:id', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, b.name as barber_name FROM customer_ratings cr
      LEFT JOIN barbers b ON b.id = cr.barber_id
      WHERE cr.customer_id = $1 ORDER BY cr.created_at DESC LIMIT 30
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
