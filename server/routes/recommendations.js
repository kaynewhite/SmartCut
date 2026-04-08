const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDocs } = require('../db');

// Recommendation system
// Parameters: specialty, ratings, availability, location, price
router.get('/', async (req, res) => {
  const { specialty, max_price, city, service_type } = req.query;
  try {
    const shops = await collection('barbershops');
    const match = { is_active: true };
    if (city) match.city = { $regex: city, $options: 'i' };
    if (service_type) {
      match.$or = [
        { name: { $regex: service_type, $options: 'i' } },
        { description: { $regex: service_type, $options: 'i' } }
      ];
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'barbershop_id',
          as: 'ratings'
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: 'barbershop_id',
          as: 'services'
        }
      },
      {
        $addFields: {
          avg_rating: { $ifNull: [{ $avg: '$ratings.barbershop_rating' }, 0] },
          review_count: { $size: '$ratings' },
          min_price: { $min: '$services.price' },
          max_price: { $max: '$services.price' }
        }
      }
    ];

    if (max_price) {
      pipeline.push({ $match: { min_price: { $lte: parseFloat(max_price) } } });
    }

    const result = await shops.aggregate(pipeline).toArray();
    const scored = result.map((shop) => {
      let score = 0;
      score += parseFloat(shop.avg_rating || 0) * 20;
      if (city && shop.city?.toLowerCase().includes(city.toLowerCase())) score += 30;
      if (max_price && shop.min_price <= parseFloat(max_price)) score += 15;
      score += Math.min(parseInt(shop.review_count || 0), 50);
      return { ...shop, score };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json(formatDocs(scored));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barber recommendations
router.get('/barbers', async (req, res) => {
  const { specialty, barbershop_id } = req.query;
  try {
    const barbers = await collection('barbers');
    const match = { is_available: true };
    if (barbershop_id) match.barbershop_id = toObjectId(barbershop_id);

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'barbershops',
          localField: 'barbershop_id',
          foreignField: '_id',
          as: 'barbershop'
        }
      },
      { $unwind: { path: '$barbershop', preserveNullAndEmptyArrays: true } },
      { $match: { 'barbershop.is_active': true } },
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'barber_id',
          as: 'ratings'
        }
      },
      {
        $lookup: {
          from: 'barber_specialties',
          localField: '_id',
          foreignField: 'barber_id',
          as: 'specialties'
        }
      },
      {
        $addFields: {
          avg_rating: { $ifNull: [{ $avg: '$ratings.barber_rating' }, 0] },
          review_count: { $size: '$ratings' },
          specialties: { $setUnion: [[], '$specialties.specialty'] },
          barbershop_name: '$barbershop.name',
          barbershop_address: '$barbershop.address'
        }
      }
    ];

    if (specialty) {
      pipeline.push({ $match: { specialties: { $elemMatch: { $regex: specialty, $options: 'i' } } } });
    }

    pipeline.push({ $sort: { avg_rating: -1 } }, { $limit: 20 });
    const result = await barbers.aggregate(pipeline).toArray();
    res.json(formatDocs(result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
