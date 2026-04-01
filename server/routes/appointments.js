const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer, authenticateBarbershop, authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Book appointment (customer)
router.post('/', authenticateCustomer, async (req, res) => {
  const { barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes } = req.body;
  if (!barbershop_id || !service_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const service = await pool.query('SELECT price FROM services WHERE id=$1', [service_id]);
    if (service.rows.length === 0) return res.status(404).json({ message: 'Service not found' });

    // Get next queue number for the day
    const queueRes = await pool.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
       FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2`,
      [barbershop_id, appointment_date]
    );
    const queue_number = queueRes.rows[0].next_queue;

    const result = await pool.query(
      `INSERT INTO appointments (customer_id, barbershop_id, barber_id, service_id, appointment_date,
       appointment_time, is_home_service, home_address, notes, total_amount, queue_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, service_id, appointment_date,
       appointment_time, is_home_service || false, home_address || null, notes || null,
       service.rows[0].price, queue_number]
    );

    // Create notification for barbershop
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
       VALUES ('barbershop', $1, 'New Booking', 'A new appointment has been booked for ${appointment_date}', 'appointment', $2)`,
      [barbershop_id, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer appointments
router.get('/my', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo,
              bar.name as barber_name, s.name as service_name, s.price as service_price, s.duration_minutes
       FROM appointments a
       JOIN barbershops b ON b.id = a.barbershop_id
       LEFT JOIN barbers bar ON bar.id = a.barber_id
       JOIN services s ON s.id = a.service_id
       WHERE a.customer_id = $1
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barbershop appointments
router.get('/barbershop', authenticateBarbershop, async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = `
      SELECT a.*, c.name as customer_name, c.phone as customer_phone,
             bar.name as barber_name, s.name as service_name, s.duration_minutes
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      LEFT JOIN barbers bar ON bar.id = a.barber_id
      JOIN services s ON s.id = a.service_id
      WHERE a.barbershop_id = $1
    `;
    const params = [req.user.id];
    let idx = 2;
    if (date) { query += ` AND a.appointment_date = $${idx++}`; params.push(date); }
    if (status) { query += ` AND a.status = $${idx++}`; params.push(status); }
    query += ' ORDER BY a.appointment_date, a.appointment_time';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update appointment status (barbershop)
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const appt = await pool.query('SELECT * FROM appointments WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (appt.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [status, req.params.id]);

    if (status === 'no_show') {
      await pool.query('UPDATE customers SET no_show_count = no_show_count + 1 WHERE id=$1', [appt.rows[0].customer_id]);
    }

    // Notify customer
    const statusMsgs = {
      confirmed: 'Your appointment has been confirmed!',
      cancelled: 'Your appointment has been cancelled.',
      completed: 'Your appointment is complete. Thank you!',
      in_progress: "Your appointment is now in progress — you're next!"
    };
    if (statusMsgs[status]) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
         VALUES ('customer', $1, $2, $3, 'appointment', $4)`,
        [appt.rows[0].customer_id, 'Appointment Update', statusMsgs[status], req.params.id]
      );
    }

    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel appointment (customer)
router.patch('/:id/cancel', authenticateCustomer, async (req, res) => {
  try {
    const appt = await pool.query('SELECT * FROM appointments WHERE id=$1 AND customer_id=$2', [req.params.id, req.user.id]);
    if (appt.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    if (!['pending', 'confirmed'].includes(appt.rows[0].status)) {
      return res.status(400).json({ message: 'Cannot cancel this appointment' });
    }
    await pool.query("UPDATE appointments SET status='cancelled' WHERE id=$1", [req.params.id]);
    res.json({ message: 'Cancelled' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload payment proof (customer)
router.post('/:id/payment-proof', authenticateCustomer, upload.single('proof'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const appt = await pool.query('SELECT * FROM appointments WHERE id=$1 AND customer_id=$2', [req.params.id, req.user.id]);
    if (appt.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const url = `/uploads/${req.file.filename}`;
    await pool.query("UPDATE appointments SET payment_proof_url=$1, payment_status='pending_verification' WHERE id=$2", [url, req.params.id]);
    // Notify barbershop
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
       VALUES ('barbershop', $1, 'Payment Proof Submitted', 'A customer has submitted payment proof for an appointment.', 'payment', $2)`,
      [appt.rows[0].barbershop_id, req.params.id]
    );
    res.json({ payment_proof_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify payment (barbershop)
router.patch('/:id/verify-payment', authenticateBarbershop, async (req, res) => {
  const { approved } = req.body;
  try {
    const appt = await pool.query('SELECT * FROM appointments WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (appt.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const newStatus = approved ? 'paid' : 'unpaid';
    await pool.query("UPDATE appointments SET payment_status=$1 WHERE id=$2", [newStatus, req.params.id]);
    if (approved) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
         VALUES ('customer', $1, 'Payment Confirmed', 'Your payment has been verified. See you at your appointment!', 'payment', $2)`,
        [appt.rows[0].customer_id, req.params.id]
      );
    }
    res.json({ message: 'Payment status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Check available slots
router.get('/available-slots', async (req, res) => {
  const { barbershop_id, barber_id, date } = req.query;
  if (!barbershop_id || !date) return res.status(400).json({ message: 'Missing params' });
  try {
    let query = `SELECT appointment_time FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled','no_show')`;
    const params = [barbershop_id, date];
    if (barber_id) { query += ' AND barber_id=$3'; params.push(barber_id); }
    const result = await pool.query(query, params);
    const booked = result.rows.map(r => r.appointment_time.substring(0, 5));
    res.json({ booked_slots: booked });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
