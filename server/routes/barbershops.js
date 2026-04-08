const express = require('express');
const router = express.Router();
const { authenticateBarbershop } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { collection, toObjectId, formatDoc, formatDocs } = require('../db');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all barbershops (public, for recommendation/explore)
router.get('/', async (req, res) => {
  try {
    const { city, service, maxPrice, search } = req.query;
    const shops = await collection('barbershops');
    const match = { is_active: true };
    if (city) match.city = { $regex: city, $options: 'i' };
    if (search) match.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];

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
        $addFields: {
          avg_rating: { $ifNull: [{ $avg: '$ratings.barbershop_rating' }, 0] },
          review_count: { $size: '$ratings' }
        }
      },
      { $sort: { avg_rating: -1 } }
    ];

    const items = await shops.aggregate(pipeline).toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single barbershop (public)
router.get('/:id', async (req, res) => {
  try {
    const shops = await collection('barbershops');
    const barbers = await collection('barbers');
    const services = await collection('services');
    const ratings = await collection('ratings');

    const shop = await shops.findOne({ _id: toObjectId(req.params.id) });
    if (!shop) return res.status(404).json({ message: 'Not found' });

    const barbersData = await barbers.aggregate([
      { $match: { barbershop_id: shop._id } },
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
          specialties: { $setUnion: [[], '$specialties.specialty'] }
        }
      },
      { $sort: { name: 1 } }
    ]).toArray();

    const servicesData = await services
      .find({ barbershop_id: shop._id, is_active: true })
      .sort({ category: 1, name: 1 })
      .toArray();

    const reviewsData = await ratings.aggregate([
      { $match: { barbershop_id: shop._id } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $sort: { created_at: -1 } },
      { $limit: 10 },
      {
        $project: {
          customer_name: '$customer.name',
          barbershop_id: 1,
          barber_id: 1,
          appointment_id: 1,
          barbershop_rating: 1,
          barber_rating: 1,
          comment: 1,
          created_at: 1
        }
      }
    ]).toArray();

    const shopSafe = { ...shop, id: shop._id.toString() };
    delete shopSafe._id;
    delete shopSafe.password;

    res.json({ shop: shopSafe, barbers: formatDocs(barbersData), services: formatDocs(servicesData), reviews: formatDocs(reviewsData) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my barbershop profile
router.get('/me/profile', authenticateBarbershop, async (req, res) => {
  try {
    const shops = await collection('barbershops');
    const shop = await shops.findOne({ _id: toObjectId(req.user.id) }, { projection: { password: 0 } });
    if (!shop) return res.status(404).json({ message: 'Not found' });
    res.json(formatDoc(shop));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update barbershop profile
router.put('/me/profile', authenticateBarbershop, async (req, res) => {
  const { name, phone, address, city, description, opening_time, closing_time, latitude, longitude } = req.body;
  try {
    const shops = await collection('barbershops');
    const update = {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(opening_time !== undefined ? { opening_time } : {}),
      ...(closing_time !== undefined ? { closing_time } : {}),
      ...(latitude !== undefined ? { latitude: parseFloat(latitude) } : {}),
      ...(longitude !== undefined ? { longitude: parseFloat(longitude) } : {})
    };
    const result = await shops.findOneAndUpdate(
      { _id: toObjectId(req.user.id) },
      { $set: update },
      { returnDocument: 'after', projection: { password: 0 } }
    );
    res.json(formatDoc(result.value));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload QR code
router.post('/me/qr-code', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    const shops = await collection('barbershops');
    await shops.updateOne({ _id: toObjectId(req.user.id) }, { $set: { qr_code_url: url } });
    res.json({ qr_code_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload logo
router.post('/me/logo', authenticateBarbershop, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    const shops = await collection('barbershops');
    await shops.updateOne({ _id: toObjectId(req.user.id) }, { $set: { logo_url: url } });
    res.json({ logo_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload cover
router.post('/me/cover', authenticateBarbershop, upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    const shops = await collection('barbershops');
    await shops.updateOne({ _id: toObjectId(req.user.id) }, { $set: { cover_url: url } });
    res.json({ cover_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard stats
router.get('/me/dashboard', authenticateBarbershop, async (req, res) => {
  try {
    const shopId = toObjectId(req.user.id);
    const appointments = await collection('appointments');
    const ratings = await collection('ratings');
    const walkIns = await collection('walk_ins');

    const today = new Date().toISOString().split('T')[0];
    const totalToday = await appointments.countDocuments({ barbershop_id: shopId, appointment_date: today, status: { $ne: 'cancelled' } });

    const totalRevenueResult = await appointments.aggregate([
      { $match: { barbershop_id: shopId, payment_status: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$total_amount' } } }
    ]).toArray();
    const totalRevenue = totalRevenueResult[0]?.revenue || 0;

    const avgRatingResult = await ratings.aggregate([
      { $match: { barbershop_id: shopId } },
      { $group: { _id: null, avg: { $avg: '$barbershop_rating' } } }
    ]).toArray();
    const avgRating = avgRatingResult[0]?.avg || 0;

    const topServices = await appointments.aggregate([
      { $match: { barbershop_id: shopId } },
      {
        $lookup: {
          from: 'services',
          localField: 'service_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$service.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { name: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    const peakHours = await appointments.aggregate([
      { $match: { barbershop_id: shopId, status: { $ne: 'cancelled' } } },
      { $project: { hour: { $toInt: { $substr: ['$appointment_time', 0, 2] } } } },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenue = await appointments.aggregate([
      {
        $addFields: {
          appointmentDate: { $dateFromString: { dateString: '$appointment_date' } }
        }
      },
      { $match: { barbershop_id: shopId, payment_status: 'paid', appointmentDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%b', date: '$appointmentDate' } },
          revenue: { $sum: '$total_amount' },
          monthSort: { $min: '$appointmentDate' }
        }
      },
      { $sort: { monthSort: 1 } },
      { $project: { month: '$_id', revenue: 1, _id: 0 } }
    ]).toArray();

    const queueCount = await walkIns.countDocuments({ barbershop_id: shopId, status: 'waiting' });

    res.json({
      today_appointments: totalToday,
      total_revenue: totalRevenue,
      avg_rating: parseFloat(avgRating).toFixed(1),
      top_services: topServices,
      peak_hours: peakHours,
      monthly_revenue: monthlyRevenue,
      queue_count: queueCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
