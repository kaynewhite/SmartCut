const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershopOrBarber } = require('../middleware/auth');
const {
  getBookedSlots,
  isSlotAvailable,
  isValidDate,
  isWithinBookingWindow
} = require('../utils/scheduling');

// PUBLIC: live queue for a shop
router.get('/:barbershopId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const apptRes = await pool.query(`
      SELECT a.id, a.queue_number, a.status, a.appointment_time, a.customer_id,
        c.name as customer_name,
        s.name as service_name, 30 as duration_minutes,
        br.name as barber_name, br.id as barber_id
      FROM appointments a
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.barbershop_id = $1
        AND a.appointment_date = $2
        AND a.status IN ('pending','confirmed','in_progress')
        AND COALESCE(a.is_event_booking, false) = false
      ORDER BY a.queue_number
    `, [req.params.barbershopId, today]);

    const walkInRes = await pool.query(`
      SELECT w.id, w.queue_number, w.status, w.customer_name, w.barber_id,
        w.appointment_time, w.appointment_date, 30 as duration_minutes,
        s.name as service_name,
        br.name as barber_name
      FROM walk_ins w
      LEFT JOIN services s ON s.id = w.service_id
      LEFT JOIN barbers br ON br.id = w.barber_id
      WHERE w.barbershop_id = $1
        AND w.status IN ('waiting','in_progress')
        AND w.appointment_date = $2
      ORDER BY w.queue_number
    `, [req.params.barbershopId, today]);

    const positions = [
      ...apptRes.rows.map(entry => ({ entry, type: 'appointment' })),
      ...walkInRes.rows.map(entry => ({ entry, type: 'walk_in' }))
    ].sort((a, b) => String(a.entry.appointment_time).localeCompare(String(b.entry.appointment_time)) ||
      Number(a.entry.queue_number) - Number(b.entry.queue_number));
    const positionByEntry = new Map(positions.map(({ entry, type }, index) => [
      `${type}:${entry.id}`,
      index + 1
    ]));
    const appointments = apptRes.rows.map(a => ({
      ...a,
      position: positionByEntry.get(`appointment:${a.id}`)
    }));
    const walk_ins = walkInRes.rows.map(w => ({
      ...w,
      position: positionByEntry.get(`walk_in:${w.id}`)
    }));

    res.json({ appointments, walk_ins });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: occupied time slots for a date
router.get('/:barbershopId/schedule', async (req, res) => {
  try {
    const { date, barber_id } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    if (!isValidDate(targetDate)) return res.status(400).json({ message: 'A valid schedule date is required' });
    if (!isWithinBookingWindow(targetDate)) {
      return res.status(400).json({ message: 'Schedules can only be viewed within the next 30 days' });
    }
    const duration = 30;
    const bookedSlots = await getBookedSlots(pool, req.params.barbershopId, barber_id, targetDate, duration);
    const occupied = bookedSlots.map(time => ({ time, occupied: true }));
    res.json({ date: targetDate, occupied });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: add walk-in (race-condition safe with advisory lock)
router.post('/', authenticateBarbershopOrBarber, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const { customer_name, service_id, barber_id, appointment_date, appointment_time } = req.body;
    if (typeof customer_name !== 'string' || !customer_name.trim()) return res.status(400).json({ message: 'Customer name required' });
    if (!isValidDate(appointment_date) || !/^\d{2}:\d{2}$/.test(appointment_time || '')) {
      return res.status(400).json({ message: 'A valid appointment date and time are required' });
    }
    if (!isWithinBookingWindow(appointment_date)) {
      return res.status(400).json({ message: 'Sessions can only be scheduled within the next 30 days' });
    }
    const shopId = req.user.type === 'barber' ? req.user.barbershop_id : req.user.id;
    const assignedBarber = req.user.type === 'barber' ? req.user.id : (barber_id || null);

    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock($1)', [parseInt(shopId)]);
    if (assignedBarber) {
      const barberCheck = await client.query(
        'SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2',
        [assignedBarber, shopId]
      );
      if (!barberCheck.rows.length) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(400).json({ message: 'Selected barber does not belong to this barbershop' });
      }
    }
    if (service_id) {
      const serviceCheck = assignedBarber
        ? await client.query(
          `SELECT s.id FROM services s
           JOIN barber_services bs ON bs.service_id=s.id AND bs.barber_id=$3
           WHERE s.id=$1 AND s.barbershop_id=$2 AND s.is_active=true AND s.price IS NOT NULL`,
          [service_id, shopId, assignedBarber]
        )
        : await client.query(
          'SELECT id FROM services WHERE id=$1 AND barbershop_id=$2 AND is_active=true AND price IS NOT NULL',
          [service_id, shopId]
        );
      if (!serviceCheck.rows.length) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(400).json({ message: assignedBarber
          ? 'Selected service is not offered by this barber'
          : 'Selected service is not available at this barbershop' });
      }
    }
    if (!await isSlotAvailable(client, shopId, assignedBarber, appointment_date, appointment_time, 30)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ message: 'This 30-minute session overlaps another booking or is outside business hours' });
    }

    const lastQ = await client.query(
      `SELECT GREATEST(
        COALESCE((SELECT MAX(queue_number) FROM walk_ins WHERE barbershop_id=$1 AND appointment_date=$2), 0),
        COALESCE((SELECT MAX(queue_number) FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2), 0)
      ) + 1 as q`,
      [shopId, appointment_date]
    );
    const result = await client.query(
      `INSERT INTO walk_ins (barbershop_id, customer_name, service_id, barber_id, queue_number, appointment_date, appointment_time, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,30) RETURNING *`,
      [shopId, customer_name.trim(), service_id || null, assignedBarber, lastQ.rows[0].q, appointment_date, appointment_time]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { client.release(); }
});

// AUTH: update walk-in status
router.patch('/:id/status', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['waiting', 'in_progress', 'done', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const shopId = req.user.type === 'barber' ? req.user.barbershop_id : req.user.id;
    const result = await pool.query(
      `UPDATE walk_ins SET status=$1 WHERE id=$2 AND barbershop_id=$3 RETURNING *`,
      [status, req.params.id, shopId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
