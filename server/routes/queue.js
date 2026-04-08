const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDocs } = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');

// Get queue for barbershop (public - customers can view)
router.get('/:shopId', async (req, res) => {
  try {
    const walkIns = await collection('walk_ins');
    const appointments = await collection('appointments');

    const walkInsPipeline = [
      { $match: { barbershop_id: toObjectId(req.params.shopId), status: { $in: ['waiting', 'in_progress'] } } },
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
          barber_name: '$barber.name',
          service_name: '$service.name',
          duration_minutes: '$service.duration_minutes',
          barbershop_id: 1,
          barber_id: 1,
          service_id: 1,
          customer_name: 1,
          status: 1,
          queue_number: 1,
          created_at: 1
        }
      },
      { $sort: { created_at: 1 } }
    ];
    const walkInItems = await walkIns.aggregate(walkInsPipeline).toArray();

    const today = new Date().toISOString().split('T')[0];
    const apptPipeline = [
      {
        $match: {
          barbershop_id: toObjectId(req.params.shopId),
          appointment_date: today,
          status: { $in: ['confirmed', 'in_progress', 'pending'] }
        }
      },
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
          queue_number: 1,
          appointment_time: 1,
          status: 1,
          customer_name: '$customer.name',
          barber_name: '$barber.name',
          service_name: '$service.name'
        }
      },
      { $sort: { appointment_time: 1 } }
    ];
    const apptQueue = await appointments.aggregate(apptPipeline).toArray();

    res.json({ walk_ins: formatDocs(walkInItems), appointments: apptQueue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add walk-in (barbershop only)
router.post('/', authenticateBarbershop, async (req, res) => {
  const { barber_id, service_id, customer_name } = req.body;
  try {
    const walkIns = await collection('walk_ins');
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
    const lastWalkIn = await walkIns
      .find({ barbershop_id: toObjectId(req.user.id), created_at: { $gte: start, $lt: end } })
      .sort({ queue_number: -1 })
      .limit(1)
      .toArray();
    const queue_number = lastWalkIn.length ? lastWalkIn[0].queue_number + 1 : 1;
    const doc = {
      barbershop_id: toObjectId(req.user.id),
      barber_id: barber_id ? toObjectId(barber_id) : null,
      service_id: service_id ? toObjectId(service_id) : null,
      customer_name: customer_name || 'Walk-in',
      queue_number,
      status: 'waiting',
      created_at: new Date()
    };
    const result = await walkIns.insertOne(doc);
    res.status(201).json({ ...doc, id: result.insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update walk-in status
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  const { status } = req.body;
  try {
    const walkIns = await collection('walk_ins');
    await walkIns.updateOne(
      { _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) },
      { $set: { status } }
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
