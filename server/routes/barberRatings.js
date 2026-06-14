const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarber, authenticateCustomer } = require('../middleware/auth');

// BARBER: rate a customer
router.post('/rate-customer', authenticateBarber, async (req, res) => {
  try {
    const { customer_id, appointment_id, rating, comment } = req.body;
    if (!customer_id || !rating) return res.status(400).json({ message: 'customer_id and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });
    const appt = await pool.query(
      'SELECT * FROM appointments WHERE id=$1 AND barber_id=$2 AND status=$3',
      [appointment_id, req.user.id, 'completed']
    );
    if (!appt.rows.length) return res.status(403).json({ message: 'Can only rate customers from completed appointments' });
    const existing = await pool.query(
      'SELECT id FROM barber_customer_ratings WHERE barber_id=$1 AND appointment_id=$2',
      [req.user.id, appointment_id]
    );
    if (existing.rows.length) return res.status(400).json({ message: 'Already rated this customer for this appointment' });
    const result = await pool.query(
      `INSERT INTO barber_customer_ratings (barber_id, customer_id, appointment_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, customer_id, appointment_id, rating, comment || null]
    );
    const avg = await pool.query(
      'SELECT AVG(rating)::numeric(3,2) as avg FROM barber_customer_ratings WHERE customer_id=$1',
      [customer_id]
    );
    await pool.query('UPDATE customers SET rating=$1 WHERE id=$2', [avg.rows[0].avg, customer_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: rate barber and barbershop (combined) — canonical rating endpoint
router.post('/rate-barbershop', authenticateCustomer, async (req, res) => {
  try {
    const { appointment_id, barbershop_id, barber_id, barbershop_rating, barber_rating, comment } = req.body;
    if (!appointment_id || !barbershop_id || !barbershop_rating) {
      return res.status(400).json({ message: 'appointment_id, barbershop_id, barbershop_rating required' });
    }
    const appt = await pool.query(
      'SELECT * FROM appointments WHERE id=$1 AND customer_id=$2 AND status=$3',
      [appointment_id, req.user.id, 'completed']
    );
    if (!appt.rows.length) return res.status(403).json({ message: 'Can only rate completed appointments' });
    const existing = await pool.query(
      'SELECT id FROM ratings WHERE appointment_id=$1 AND customer_id=$2',
      [appointment_id, req.user.id]
    );
    if (existing.rows.length) return res.status(400).json({ message: 'Already rated this appointment' });

    await pool.query(
      `INSERT INTO ratings (customer_id, barbershop_id, barber_id, appointment_id, barbershop_rating, barber_rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.user.id, barbershop_id, barber_id || null, appointment_id, barbershop_rating, barber_rating || null, comment || null]
    );

    // Update shop average rating
    const shopAvg = await pool.query('SELECT AVG(barbershop_rating)::numeric(3,2) as avg FROM ratings WHERE barbershop_id=$1', [barbershop_id]);
    await pool.query('UPDATE barbershops SET rating=$1 WHERE id=$2', [shopAvg.rows[0].avg || 5.0, barbershop_id]);

    // Update barber average rating
    if (barber_id && barber_rating) {
      const barberAvg = await pool.query('SELECT AVG(barber_rating)::numeric(3,2) as avg FROM ratings WHERE barber_id=$1 AND barber_rating IS NOT NULL', [barber_id]);
      await pool.query('UPDATE barbers SET rating=$1 WHERE id=$2', [barberAvg.rows[0].avg || 5.0, barber_id]);
    }

    // Award 10 loyalty points for leaving a review (idempotent via rating existence check above)
    await pool.query(
      `INSERT INTO customer_shop_loyalty (customer_id, barbershop_id, points, updated_at) VALUES ($1,$2,10,NOW())
       ON CONFLICT (customer_id, barbershop_id) DO UPDATE SET points=customer_shop_loyalty.points+10, updated_at=NOW()`,
      [req.user.id, barbershop_id]
    );
    await pool.query(
      `INSERT INTO loyalty_transactions (customer_id, barbershop_id, points, type, description) VALUES ($1,$2,10,'earned',$3)`,
      [req.user.id, barbershop_id, `Review bonus for appointment #${appointment_id}`]
    );

    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
       VALUES ('barbershop',$1,'⭐ New Review','A customer left a review for your shop.','review',$2)`,
      [barbershop_id, appointment_id]
    );
    res.status(201).json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Get customer ratings (barber viewing their rated customers)
router.get('/customer/:id', authenticateBarber, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.name as customer_name FROM barber_customer_ratings r
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE r.customer_id = $1 ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
