const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDoc, formatDocs } = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// Get customer profile
router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const customers = await collection('customers');
    const customer = await customers.findOne({ _id: toObjectId(req.user.id) }, { projection: { password: 0 } });
    res.json(formatDoc(customer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer profile
router.put('/me', authenticateCustomer, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const customers = await collection('customers');
    const result = await customers.findOneAndUpdate(
      { _id: toObjectId(req.user.id) },
      { $set: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) } },
      { returnDocument: 'after', projection: { password: 0 } }
    );
    res.json(formatDoc(result.value));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get haircut history
router.get('/me/history', authenticateCustomer, async (req, res) => {
  try {
    const appointments = await collection('appointments');
    const pipeline = [
      { $match: { customer_id: toObjectId(req.user.id), status: 'completed' } },
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
        $lookup: {
          from: 'ratings',
          let: { appointmentId: '$_id', customerId: '$customer_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$appointment_id', '$$appointmentId'] }, { $eq: ['$customer_id', '$$customerId'] } ] } } }
          ],
          as: 'rating'
        }
      },
      { $unwind: { path: '$rating', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          barbershop_name: '$barbershop.name',
          barbershop_logo: '$barbershop.logo_url',
          barbershop_address: '$barbershop.address',
          barber_name: '$barber.name',
          service_name: '$service.name',
          price: '$service.price',
          barbershop_rating: '$rating.barbershop_rating',
          barber_rating: '$rating.barber_rating',
          review: '$rating.comment',
          appointment_date: 1,
          appointment_time: 1,
          status: 1,
          total_amount: 1,
          queue_number: 1,
          payment_status: 1,
          created_at: 1
        }
      },
      { $sort: { appointment_date: -1 } }
    ];
    const items = await appointments.aggregate(pipeline).toArray();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get loyalty points history
router.get('/me/loyalty', authenticateCustomer, async (req, res) => {
  try {
    const customers = await collection('customers');
    const loyaltyTransactions = await collection('loyalty_transactions');
    const customer = await customers.findOne({ _id: toObjectId(req.user.id) });
    const history = await loyaltyTransactions
      .find({ customer_id: toObjectId(req.user.id) })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();
    res.json({ total_points: customer?.loyalty_points || 0, history: formatDocs(history) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
