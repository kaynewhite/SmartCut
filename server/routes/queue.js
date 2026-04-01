const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');

// Get queue for barbershop (public - customers can view)
router.get('/:shopId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.*, bar.name as barber_name, s.name as service_name, s.duration_minutes
       FROM walk_ins w
       LEFT JOIN barbers bar ON bar.id = w.barber_id
       LEFT JOIN services s ON s.id = w.service_id
       WHERE w.barbershop_id = $1 AND w.status IN ('waiting','in_progress')
       ORDER BY w.created_at`,
      [req.params.shopId]
    );
    // Also get today's appointments queue
    const today = new Date().toISOString().split('T')[0];
    const apptQueue = await pool.query(
      `SELECT a.queue_number, a.appointment_time, a.status, c.name as customer_name,
              bar.name as barber_name, s.name as service_name
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       LEFT JOIN barbers bar ON bar.id = a.barber_id
       JOIN services s ON s.id = a.service_id
       WHERE a.barbershop_id = $1 AND a.appointment_date = $2 AND a.status IN ('confirmed','in_progress','pending')
       ORDER BY a.appointment_time`,
      [req.params.shopId, today]
    );
    res.json({ walk_ins: result.rows, appointments: apptQueue.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add walk-in (barbershop only)
router.post('/', authenticateBarbershop, async (req, res) => {
  const { barber_id, service_id, customer_name } = req.body;
  try {
    const queueRes = await pool.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as next FROM walk_ins WHERE barbershop_id=$1 AND DATE(created_at)=CURRENT_DATE`,
      [req.user.id]
    );
    const queue_number = queueRes.rows[0].next;
    const result = await pool.query(
      `INSERT INTO walk_ins (barbershop_id, barber_id, service_id, customer_name, queue_number)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, barber_id || null, service_id || null, customer_name || 'Walk-in', queue_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update walk-in status
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE walk_ins SET status=$1 WHERE id=$2 AND barbershop_id=$3', [status, req.params.id, req.user.id]);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
