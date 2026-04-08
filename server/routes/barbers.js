const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDocs, formatDoc } = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all barbers for barbershop
router.get('/', authenticateBarbershop, async (req, res) => {
  try {
    const barbers = await collection('barbers');
    const pipeline = [
      { $match: { barbershop_id: toObjectId(req.user.id) } },
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
    ];
    const items = await barbers.aggregate(pipeline).toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add barber
router.post('/', authenticateBarbershop, async (req, res) => {
  const { name, phone, bio, specialties } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  try {
    const barbers = await collection('barbers');
    const barberSpecialties = await collection('barber_specialties');
    const barberDoc = {
      barbershop_id: toObjectId(req.user.id),
      name,
      phone: phone || null,
      bio: bio || null,
      is_available: true,
      created_at: new Date()
    };
    const result = await barbers.insertOne(barberDoc);
    const barber = { ...barberDoc, id: result.insertedId.toString() };
    if (specialties && specialties.length > 0) {
      await barberSpecialties.insertMany(
        specialties.map((sp) => ({ barber_id: result.insertedId, specialty: sp }))
      );
    }
    res.status(201).json(barber);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update barber
router.put('/:id', authenticateBarbershop, async (req, res) => {
  const { name, phone, bio, is_available, specialties } = req.body;
  try {
    const barbers = await collection('barbers');
    const barber = await barbers.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!barber) return res.status(403).json({ message: 'Forbidden' });
    const update = {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(is_available !== undefined ? { is_available } : {})
    };
    const result = await barbers.findOneAndUpdate(
      { _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (specialties) {
      const barberSpecialties = await collection('barber_specialties');
      await barberSpecialties.deleteMany({ barber_id: toObjectId(req.params.id) });
      if (specialties.length > 0) {
        await barberSpecialties.insertMany(
          specialties.map((sp) => ({ barber_id: toObjectId(req.params.id), specialty: sp }))
        );
      }
    }
    res.json(formatDoc(result.value));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload barber photo
router.post('/:id/photo', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const barbers = await collection('barbers');
    const barber = await barbers.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!barber) return res.status(403).json({ message: 'Forbidden' });
    const url = `/uploads/${req.file.filename}`;
    await barbers.updateOne({ _id: toObjectId(req.params.id) }, { $set: { photo_url: url } });
    res.json({ photo_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete barber
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const barbers = await collection('barbers');
    const barber = await barbers.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!barber) return res.status(403).json({ message: 'Forbidden' });
    await barbers.deleteOne({ _id: toObjectId(req.params.id) });
    const barberSpecialties = await collection('barber_specialties');
    const barberSchedules = await collection('barber_schedules');
    await barberSpecialties.deleteMany({ barber_id: toObjectId(req.params.id) });
    await barberSchedules.deleteMany({ barber_id: toObjectId(req.params.id) });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barber schedule
router.get('/:id/schedule', async (req, res) => {
  try {
    const schedules = await collection('barber_schedules');
    const items = await schedules
      .find({ barber_id: toObjectId(req.params.id) })
      .sort({ day_of_week: 1 })
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set barber schedule
router.post('/:id/schedule', authenticateBarbershop, async (req, res) => {
  const { schedules } = req.body;
  try {
    const barberSchedules = await collection('barber_schedules');
    await barberSchedules.deleteMany({ barber_id: toObjectId(req.params.id) });
    if (schedules && schedules.length > 0) {
      await barberSchedules.insertMany(
        schedules.map((s) => ({
          barber_id: toObjectId(req.params.id),
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          is_available: s.is_available !== false
        }))
      );
    }
    res.json({ message: 'Schedule updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
