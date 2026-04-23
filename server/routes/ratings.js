const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// CUSTOMER: create rating
router.post('/', authenticateCustomer, async (req, res) => {
  const { appointment_id, barbershop_id, barber_id, barbershop_rating, barber_rating, comment } = req.body;
  if (!appointment_id || !barbershop_id || !barbershop_rating) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM ratings WHERE appointment_id = $1 AND customer_id = $2', [appointment_id, req.user.id]);
    if (existing.rows.length) return res.status(400).json({ message: 'Already rated' });

    const result = await pool.query(
      `INSERT INTO ratings (customer_id, barbershop_id, barber_id, appointment_id, barbershop_rating, barber_rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, appointment_id, barbershop_rating, barber_rating || null, comment || null]
    );
    // award loyalty
    await pool.query('UPDATE customers SET loyalty_points = loyalty_points + 10 WHERE id = $1', [req.user.id]);
    await pool.query(`INSERT INTO loyalty_transactions (customer_id, points, type, description) VALUES ($1,10,'earned','Posted a review')`, [req.user.id]);

    // update barber rating average
    if (barber_id && barber_rating) {
      const avg = await pool.query('SELECT AVG(barber_rating)::numeric(3,2) as a FROM ratings WHERE barber_id = $1', [barber_id]);
      await pool.query('UPDATE barbers SET rating = $1 WHERE id = $2', [avg.rows[0].a || 5.0, barber_id]);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: get ratings for a barbershop
router.get('/barbershop/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name as customer_name, c.avatar_url as customer_avatar, br.name as barber_name, s.name as service_name
      FROM ratings r
      LEFT JOIN customers c ON c.id = r.customer_id
      LEFT JOIN barbers br ON br.id = r.barber_id
      LEFT JOIN appointments a ON a.id = r.appointment_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE r.barbershop_id = $1
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
