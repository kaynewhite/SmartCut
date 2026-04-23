const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershopOrBarber } = require('../middleware/auth');

// PUBLIC: get current queue for a shop (anonymized for customers)
router.get('/:barbershopId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const apptRes = await pool.query(`
      SELECT a.id, a.queue_number, a.status, a.appointment_time,
        s.name as service_name, br.name as barber_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.barbershop_id = $1 AND a.appointment_date = $2 AND a.status IN ('pending','confirmed','in_progress')
      ORDER BY a.queue_number
    `, [req.params.barbershopId, today]);
    const walkInRes = await pool.query(`
      SELECT w.id, w.queue_number, w.status, s.name as service_name, br.name as barber_name
      FROM walk_ins w
      LEFT JOIN services s ON s.id = w.service_id
      LEFT JOIN barbers br ON br.id = w.barber_id
      WHERE w.barbershop_id = $1 AND w.status IN ('waiting','in_progress') AND DATE(w.created_at) = $2
      ORDER BY w.queue_number
    `, [req.params.barbershopId, today]);
    res.json({ appointments: apptRes.rows, walk_ins: walkInRes.rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: occupied time slots for a date (just times, no names)
router.get('/:barbershopId/schedule', async (req, res) => {
  try {
    const { date, barber_id } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    let q = `SELECT appointment_time FROM appointments WHERE barbershop_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')`;
    const params = [req.params.barbershopId, targetDate];
    if (barber_id) { params.push(barber_id); q += ` AND barber_id = $3`; }
    const result = await pool.query(q, params);
    const occupied = result.rows.map(r => ({ time: r.appointment_time?.substring(0,5), occupied: true }));
    res.json({ date: targetDate, occupied });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: add walk-in (owner or barber)
router.post('/', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { customer_name, service_id, barber_id } = req.body;
    if (!customer_name) return res.status(400).json({ message: 'Customer name required' });
    const shopId = req.user.type === 'barber' ? req.user.barbershop_id : req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const lastQ = await pool.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as q FROM walk_ins WHERE barbershop_id = $1 AND DATE(created_at) = $2`,
      [shopId, today]
    );
    const result = await pool.query(
      `INSERT INTO walk_ins (barbershop_id, customer_name, service_id, barber_id, queue_number) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [shopId, customer_name, service_id || null, barber_id || (req.user.type === 'barber' ? req.user.id : null), lastQ.rows[0].q]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update walk-in status
router.patch('/:id/status', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['waiting','in_progress','done','cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid' });
    const shopId = req.user.type === 'barber' ? req.user.barbershop_id : req.user.id;
    const result = await pool.query(
      `UPDATE walk_ins SET status = $1 WHERE id = $2 AND barbershop_id = $3 RETURNING *`,
      [status, req.params.id, shopId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
