const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// Submit rating
router.post('/', authenticateCustomer, async (req, res) => {
  const { barbershop_id, barber_id, appointment_id, barbershop_rating, barber_rating, comment } = req.body;
  if (!barbershop_id || !barbershop_rating) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const existing = await pool.query('SELECT id FROM ratings WHERE appointment_id=$1 AND customer_id=$2', [appointment_id, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ message: 'Already rated' });

    const result = await pool.query(
      `INSERT INTO ratings (customer_id, barbershop_id, barber_id, appointment_id, barbershop_rating, barber_rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, appointment_id || null, barbershop_rating, barber_rating || null, comment || null]
    );

    // Update barbershop avg rating
    const shopAvg = await pool.query('SELECT AVG(barbershop_rating) as avg FROM ratings WHERE barbershop_id=$1', [barbershop_id]);
    await pool.query('UPDATE barbershops SET is_active=is_active WHERE id=$1', [barbershop_id]);

    // Update barber avg rating
    if (barber_id && barber_rating) {
      const barberAvg = await pool.query('SELECT AVG(barber_rating) as avg FROM ratings WHERE barber_id=$1', [barber_id]);
      await pool.query('UPDATE barbers SET rating=$1 WHERE id=$2', [parseFloat(barberAvg.rows[0].avg).toFixed(2), barber_id]);
    }

    // Add loyalty points
    await pool.query('UPDATE customers SET loyalty_points = loyalty_points + 10 WHERE id=$1', [req.user.id]);
    await pool.query(
      `INSERT INTO loyalty_transactions (customer_id, points, type, description) VALUES ($1, 10, 'earned', 'Rating submitted')`,
      [req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ratings for a barbershop
router.get('/barbershop/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name as customer_name, bar.name as barber_name
       FROM ratings r JOIN customers c ON c.id=r.customer_id
       LEFT JOIN barbers bar ON bar.id=r.barber_id
       WHERE r.barbershop_id=$1 ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
