const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDocs } = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// Submit rating
router.post('/', authenticateCustomer, async (req, res) => {
  const { barbershop_id, barber_id, appointment_id, barbershop_rating, barber_rating, comment } = req.body;
  if (!barbershop_id || barbershop_rating === undefined) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const ratings = await collection('ratings');
    const customers = await collection('customers');
    const barbers = await collection('barbers');
    const loyaltyTransactions = await collection('loyalty_transactions');

    const existing = await ratings.findOne({ appointment_id: appointment_id ? toObjectId(appointment_id) : null, customer_id: toObjectId(req.user.id) });
    if (existing) return res.status(409).json({ message: 'Already rated' });

    const ratingDoc = {
      customer_id: toObjectId(req.user.id),
      barbershop_id: toObjectId(barbershop_id),
      barber_id: barber_id ? toObjectId(barber_id) : null,
      appointment_id: appointment_id ? toObjectId(appointment_id) : null,
      barbershop_rating,
      barber_rating: barber_rating || null,
      comment: comment || null,
      created_at: new Date()
    };
    const result = await ratings.insertOne(ratingDoc);

    if (barber_id && barber_rating) {
      const avgResult = await ratings.aggregate([
        { $match: { barber_id: toObjectId(barber_id) } },
        { $group: { _id: null, avg: { $avg: '$barber_rating' } } }
      ]).toArray();
      const barberAvg = avgResult[0]?.avg || 0;
      await barbers.updateOne({ _id: toObjectId(barber_id) }, { $set: { rating: parseFloat(barberAvg).toFixed(2) } });
    }

    await customers.updateOne({ _id: toObjectId(req.user.id) }, { $inc: { loyalty_points: 10 } });
    await loyaltyTransactions.insertOne({
      customer_id: req.user.id,
      points: 10,
      type: 'earned',
      description: 'Rating submitted',
      created_at: new Date()
    });

    res.status(201).json({ ...ratingDoc, id: result.insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ratings for a barbershop
router.get('/barbershop/:id', async (req, res) => {
  try {
    const ratings = await collection('ratings');
    const pipeline = [
      { $match: { barbershop_id: toObjectId(req.params.id) } },
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
        $project: {
          customer_name: '$customer.name',
          barber_name: '$barber.name',
          customer_id: 1,
          barbershop_id: 1,
          barber_id: 1,
          appointment_id: 1,
          barbershop_rating: 1,
          barber_rating: 1,
          comment: 1,
          created_at: 1
        }
      },
      { $sort: { created_at: -1 } }
    ];
    const items = await ratings.aggregate(pipeline).toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
