const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');

// PUBLIC: get current queue for a shop
router.get('/:barbershopId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const apptRes = await pool.query(`
      SELECT a.id, a.queue_number, a.status, a.appointment_time,
        c.name as customer_name, s.name as service_name, br.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.barbershop_id = $1 AND a.appointment_date = $2 AND a.status IN ('pending','confirmed','in_progress')
      ORDER BY a.queue_number
    `, [req.params.barbershopId, today]);
    const walkInRes = await pool.query(`
      SELECT w.*, s.name as service_name, br.name as barber_name
      FROM walk_ins w
      LEFT JOIN services s ON s.id = w.service_id
      LEFT JOIN barbers br ON br.id = w.barber_id
      WHERE w.barbershop_id = $1 AND w.status IN ('waiting','in_progress') AND DATE(w.created_at) = $2
      ORDER BY w.queue_number
    `, [req.params.barbershopId, today]);
    res.json({ appointments: apptRes.rows, walk_ins: walkInRes.rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: add walk-in
router.post('/', authenticateBarbershop, async (req, res) => {
  try {
    const { customer_name, service_id, barber_id } = req.body;
    if (!customer_name) return res.status(400).json({ message: 'Customer name required' });
    const today = new Date().toISOString().split('T')[0];
    const lastQ = await pool.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as q FROM walk_ins WHERE barbershop_id = $1 AND DATE(created_at) = $2`,
      [req.user.id, today]
    );
    const result = await pool.query(
      `INSERT INTO walk_ins (barbershop_id, customer_name, service_id, barber_id, queue_number) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, customer_name, service_id || null, barber_id || null, lastQ.rows[0].q]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update walk-in status
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['waiting','in_progress','done','cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid' });
    const result = await pool.query(
      `UPDATE walk_ins SET status = $1 WHERE id = $2 AND barbershop_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
