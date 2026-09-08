const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershopOrBarber } = require('../middleware/auth');
const { broadcastQueueUpdate, emitToShop } = require('../socket');

// PUBLIC: live unified queue for a shop
router.get('/:barbershopId', async (req, res) => {
  try {
    const shopId = req.params.barbershopId;
    const today = new Date().toISOString().split('T')[0];

    // 1. Appointments
    const apptRes = await pool.query(
      `SELECT a.id, a.queue_number, a.status, a.appointment_time, a.customer_id,
              a.is_home_service, a.total_amount, a.notes,
              c.name as customer_name, c.avatar_url as customer_avatar,
              s.id as service_id, s.name as service_name, COALESCE(s.duration_minutes, 25) as duration_minutes,
              br.id as barber_id, br.name as barber_name, br.photo_url as barber_photo
       FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN services s ON s.id = a.service_id
       LEFT JOIN barbers br ON br.id = a.barber_id
       WHERE a.barbershop_id = $1
         AND a.appointment_date = $2
         AND a.status IN ('pending', 'confirmed', 'in_progress')
       ORDER BY a.queue_number ASC, a.appointment_time ASC`,
      [shopId, today]
    );

    // 2. Walk-ins
    const walkInRes = await pool.query(
      `SELECT w.id, w.queue_number, w.status, w.customer_name, w.created_at,
              s.id as service_id, s.name as service_name, COALESCE(s.duration_minutes, 25) as duration_minutes,
              br.id as barber_id, br.name as barber_name, br.photo_url as barber_photo
       FROM walk_ins w
       LEFT JOIN services s ON s.id = w.service_id
       LEFT JOIN barbers br ON br.id = w.barber_id
       WHERE w.barbershop_id = $1
         AND w.status IN ('waiting', 'in_progress')
         AND DATE(w.created_at) = $2
       ORDER BY w.queue_number ASC, w.created_at ASC`,
      [shopId, today]
    );

    // 3. Active Barbers & Chairs
    const barbersRes = await pool.query(
      `SELECT id, name, photo_url, is_available, rating
       FROM barbers
       WHERE barbershop_id = $1
       ORDER BY id ASC`,
      [shopId]
    );

    // Merge and compute unified queue with true sequential positions
    const rawUnified = [
      ...apptRes.rows.map((a) => ({
        ...a,
        type: 'appointment',
        display_type: a.is_home_service ? 'Home Service' : 'Appointment',
        sort_key: a.status === 'in_progress' ? 0 : 1,
        time_display: a.appointment_time ? a.appointment_time.substring(0, 5) : null,
      })),
      ...walkInRes.rows.map((w) => ({
        ...w,
        type: 'walk_in',
        display_type: 'Walk-in',
        sort_key: w.status === 'in_progress' ? 0 : 1,
        time_display: new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    ];

    // In-progress first, then by queue_number
    rawUnified.sort((a, b) => {
      if (a.sort_key !== b.sort_key) return a.sort_key - b.sort_key;
      return (a.queue_number || 0) - (b.queue_number || 0);
    });

    const unified_queue = rawUnified.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));

    // Build Chairs View
    const chairs = barbersRes.rows.map((barber) => {
      const currentServing = unified_queue.find(
        (q) => String(q.barber_id) === String(barber.id) && q.status === 'in_progress'
      );
      const waitingList = unified_queue.filter(
        (q) =>
          String(q.barber_id) === String(barber.id) &&
          (q.status === 'waiting' || q.status === 'confirmed' || q.status === 'pending')
      );

      return {
        barber_id: barber.id,
        barber_name: barber.name,
        photo_url: barber.photo_url,
        is_available: barber.is_available,
        status: !barber.is_available ? 'offline' : currentServing ? 'serving' : 'available',
        current_serving: currentServing || null,
        next_up: waitingList[0] || null,
        waiting_count: waitingList.length,
      };
    });

    const waitingItems = unified_queue.filter(
      (item) => item.status === 'waiting' || item.status === 'confirmed' || item.status === 'pending'
    );
    const inProgressItems = unified_queue.filter((item) => item.status === 'in_progress');

    const totalEstWait = waitingItems.reduce(
      (sum, item) => sum + (parseInt(item.duration_minutes, 10) || 25),
      0
    );

    const activeBarbersCount = barbersRes.rows.filter((b) => b.is_available).length || 1;
    const estWaitMinutes = Math.ceil(totalEstWait / Math.max(activeBarbersCount, 1));

    res.json({
      unified_queue,
      appointments: apptRes.rows,
      walk_ins: walkInRes.rows,
      chairs,
      stats: {
        total_waiting: waitingItems.length,
        in_progress_count: inProgressItems.length,
        active_barbers_count: activeBarbersCount,
        est_wait_minutes: estWaitMinutes,
      },
    });
  } catch (err) {
    console.error('Error fetching live queue:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUBLIC: occupied time slots for a date
router.get('/:barbershopId/schedule', async (req, res) => {
  try {
    const { date, barber_id } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    let q = `SELECT appointment_time FROM appointments WHERE barbershop_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')`;
    const params = [req.params.barbershopId, targetDate];
    if (barber_id) {
      params.push(barber_id);
      q += ` AND barber_id = $3`;
    }
    const result = await pool.query(q, params);
    const occupied = result.rows.map((r) => ({
      time: r.appointment_time?.substring(0, 5),
      occupied: true,
    }));
    res.json({ date: targetDate, occupied });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// AUTH: add walk-in (race-condition safe with advisory lock)
router.post('/', authenticateBarbershopOrBarber, async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name, service_id, barber_id } = req.body;
    if (!customer_name) return res.status(400).json({ message: 'Customer name required' });
    const shopId = req.user.type === 'barber' ? req.user.barbershop_id : req.user.id;
    const today = new Date().toISOString().split('T')[0];

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [parseInt(shopId, 10)]);

    const lastQ = await client.query(
      `SELECT GREATEST(
        COALESCE((SELECT MAX(queue_number) FROM walk_ins WHERE barbershop_id=$1 AND DATE(created_at)=$2), 0),
        COALESCE((SELECT MAX(queue_number) FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2), 0)
      ) + 1 as q`,
      [shopId, today]
    );

    const assignedBarber = barber_id || (req.user.type === 'barber' ? req.user.id : null);
    const result = await client.query(
      `INSERT INTO walk_ins (barbershop_id, customer_name, service_id, barber_id, queue_number) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [shopId, customer_name, service_id || null, assignedBarber, lastQ.rows[0].q]
    );
    await client.query('COMMIT');

    const created = result.rows[0];

    // Real-time broadcast
    broadcastQueueUpdate(shopId);

    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating walk-in:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
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

    // Real-time broadcast
    broadcastQueueUpdate(shopId);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating walk-in status:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
