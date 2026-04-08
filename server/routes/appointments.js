const express = require('express');
const router = express.Router();
const { authenticateCustomer, authenticateBarbershop } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { collection, toObjectId, formatDoc, formatDocs } = require('../db');

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
    const services = await collection('services');
    const appointments = await collection('appointments');
    const notifications = await collection('notifications');

    const service = await services.findOne({ _id: toObjectId(service_id) });
    if (!service) return res.status(404).json({ message: 'Service not found' });

    const lastAppointment = await appointments
      .find({ barbershop_id: toObjectId(barbershop_id), appointment_date })
      .sort({ queue_number: -1 })
      .limit(1)
      .toArray();
    const queue_number = lastAppointment.length ? lastAppointment[0].queue_number + 1 : 1;

    const appointmentDoc = {
      customer_id: toObjectId(req.user.id),
      barbershop_id: toObjectId(barbershop_id),
      barber_id: barber_id ? toObjectId(barber_id) : null,
      service_id: toObjectId(service_id),
      appointment_date,
      appointment_time,
      is_home_service: !!is_home_service,
      home_address: home_address || null,
      notes: notes || null,
      total_amount: service.price,
      queue_number,
      status: 'pending',
      payment_status: 'pending',
      created_at: new Date()
    };

    const result = await appointments.insertOne(appointmentDoc);
    await notifications.insertOne({
      recipient_type: 'barbershop',
      recipient_id: toObjectId(barbershop_id),
      title: 'New Booking',
      message: `A new appointment has been booked for ${appointment_date}`,
      type: 'appointment',
      related_id: result.insertedId,
      created_at: new Date()
    });

    res.status(201).json({ ...appointmentDoc, id: result.insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer appointments
router.get('/my', authenticateCustomer, async (req, res) => {
  try {
    const appointments = await collection('appointments');
    const pipeline = [
      { $match: { customer_id: toObjectId(req.user.id) } },
      {
        $lookup: {
          from: 'barbershops',
          localField: 'barbershop_id',
          foreignField: '_id',
          as: 'barbershop'
        }
      },
      { $unwind: { path: '$barbershop', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'barbers',
          localField: 'barber_id',
          foreignField: '_id',
          as: 'barber'
        }
      },
      { $unwind: { path: '$barber', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'service_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          barbershop_name: '$barbershop.name',
          barbershop_address: '$barbershop.address',
          barbershop_logo: '$barbershop.logo_url',
          barber_name: '$barber.name',
          service_name: '$service.name',
          service_price: '$service.price',
          duration_minutes: '$service.duration_minutes',
          customer_id: 1,
          barbershop_id: 1,
          barber_id: 1,
          service_id: 1,
          appointment_date: 1,
          appointment_time: 1,
          is_home_service: 1,
          home_address: 1,
          notes: 1,
          total_amount: 1,
          queue_number: 1,
          status: 1,
          payment_status: 1,
          created_at: 1
        }
      },
      { $sort: { appointment_date: -1, appointment_time: -1 } }
    ];
    const items = await appointments.aggregate(pipeline).toArray();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barbershop appointments
router.get('/barbershop', authenticateBarbershop, async (req, res) => {
  try {
    const { date, status } = req.query;
    const appointments = await collection('appointments');
    const match = { barbershop_id: toObjectId(req.user.id) };
    if (date) match.appointment_date = date;
    if (status) match.status = status;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'barbers',
          localField: 'barber_id',
          foreignField: '_id',
          as: 'barber'
        }
      },
      { $unwind: { path: '$barber', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'service_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customer_name: '$customer.name',
          customer_phone: '$customer.phone',
          barber_name: '$barber.name',
          service_name: '$service.name',
          duration_minutes: '$service.duration_minutes',
          appointment_date: 1,
          appointment_time: 1,
          status: 1,
          payment_status: 1,
          queue_number: 1,
          created_at: 1
        }
      },
      { $sort: { appointment_date: 1, appointment_time: 1 } }
    ];
    const items = await appointments.aggregate(pipeline).toArray();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update appointment status (barbershop)
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const appointments = await collection('appointments');
    const customers = await collection('customers');
    const notifications = await collection('notifications');
    const appt = await appointments.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!appt) return res.status(404).json({ message: 'Not found' });

    await appointments.updateOne({ _id: appt._id }, { $set: { status } });

    if (status === 'no_show') {
      await customers.updateOne({ _id: toObjectId(appt.customer_id) }, { $inc: { no_show_count: 1 } });
    }

    const statusMsgs = {
      confirmed: 'Your appointment has been confirmed!',
      cancelled: 'Your appointment has been cancelled.',
      completed: 'Your appointment is complete. Thank you!',
      in_progress: "Your appointment is now in progress — you're next!"
    };
    if (statusMsgs[status]) {
      await notifications.insertOne({
        recipient_type: 'customer',
        recipient_id: appt.customer_id,
        title: 'Appointment Update',
        message: statusMsgs[status],
        type: 'appointment',
        related_id: appt._id,
        created_at: new Date()
      });
    }

    res.json({ message: 'Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel appointment (customer)
router.patch('/:id/cancel', authenticateCustomer, async (req, res) => {
  try {
    const appointments = await collection('appointments');
    const appt = await appointments.findOne({ _id: toObjectId(req.params.id), customer_id: toObjectId(req.user.id) });
    if (!appt) return res.status(404).json({ message: 'Not found' });
    if (!['pending', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ message: 'Cannot cancel this appointment' });
    }
    await appointments.updateOne({ _id: appt._id }, { $set: { status: 'cancelled' } });
    res.json({ message: 'Cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload payment proof (customer)
router.post('/:id/payment-proof', authenticateCustomer, upload.single('proof'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const appointments = await collection('appointments');
    const notifications = await collection('notifications');
    const appt = await appointments.findOne({ _id: toObjectId(req.params.id), customer_id: toObjectId(req.user.id) });
    if (!appt) return res.status(404).json({ message: 'Not found' });
    const url = `/uploads/${req.file.filename}`;
    await appointments.updateOne({ _id: appt._id }, { $set: { payment_proof_url: url, payment_status: 'pending_verification' } });
    await notifications.insertOne({
      recipient_type: 'barbershop',
      recipient_id: appt.barbershop_id,
      title: 'Payment Proof Submitted',
      message: 'A customer has submitted payment proof for an appointment.',
      type: 'payment',
      related_id: appt._id,
      created_at: new Date()
    });
    res.json({ payment_proof_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify payment (barbershop)
router.patch('/:id/verify-payment', authenticateBarbershop, async (req, res) => {
  const { approved } = req.body;
  try {
    const appointments = await collection('appointments');
    const notifications = await collection('notifications');
    const appt = await appointments.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!appt) return res.status(404).json({ message: 'Not found' });
    const newStatus = approved ? 'paid' : 'unpaid';
    await appointments.updateOne({ _id: appt._id }, { $set: { payment_status: newStatus } });
    if (approved) {
      await notifications.insertOne({
        recipient_type: 'customer',
        recipient_id: appt.customer_id,
        title: 'Payment Confirmed',
        message: 'Your payment has been verified. See you at your appointment!',
        type: 'payment',
        related_id: appt._id,
        created_at: new Date()
      });
    }
    res.json({ message: 'Payment status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check available slots
router.get('/available-slots', async (req, res) => {
  const { barbershop_id, barber_id, date } = req.query;
  if (!barbershop_id || !date) return res.status(400).json({ message: 'Missing params' });
  try {
    const appointments = await collection('appointments');
    const match = {
      barbershop_id: toObjectId(barbershop_id),
      appointment_date: date,
      status: { $nin: ['cancelled', 'no_show'] }
    };
    if (barber_id) match.barber_id = toObjectId(barber_id);
    const bookedDocs = await appointments.find(match).toArray();
    const booked = bookedDocs.map((r) => (typeof r.appointment_time === 'string' ? r.appointment_time.substring(0, 5) : r.appointment_time));
    res.json({ booked_slots: booked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
