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

// Get services for a barbershop
router.get('/barbershop/:shopId', async (req, res) => {
  try {
    const services = await collection('services');
    const items = await services
      .find({ barbershop_id: toObjectId(req.params.shopId), is_active: true })
      .sort({ category: 1, name: 1 })
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my services
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const services = await collection('services');
    const items = await services
      .find({ barbershop_id: toObjectId(req.user.id) })
      .sort({ category: 1, name: 1 })
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add service
router.post('/', authenticateBarbershop, async (req, res) => {
  const { name, description, price, duration_minutes, category, is_home_service } = req.body;
  if (!name || !price) return res.status(400).json({ message: 'Name and price required' });
  try {
    const services = await collection('services');
    const serviceDoc = {
      barbershop_id: toObjectId(req.user.id),
      name,
      description: description || null,
      price,
      duration_minutes: duration_minutes || 30,
      category: category || 'haircut',
      is_home_service: is_home_service || false,
      is_active: true,
      created_at: new Date()
    };
    const result = await services.insertOne(serviceDoc);
    res.status(201).json({ ...serviceDoc, id: result.insertedId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload service image
router.post('/:id/image', authenticateBarbershop, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const services = await collection('services');
    const own = await services.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!own) return res.status(403).json({ message: 'Forbidden' });
    const url = `/uploads/${req.file.filename}`;
    await services.updateOne({ _id: toObjectId(req.params.id) }, { $set: { image_url: url } });
    res.json({ image_url: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update service
router.put('/:id', authenticateBarbershop, async (req, res) => {
  const { name, description, price, duration_minutes, category, is_active, is_home_service } = req.body;
  try {
    const services = await collection('services');
    const own = await services.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!own) return res.status(403).json({ message: 'Forbidden' });
    const update = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(duration_minutes !== undefined ? { duration_minutes } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
      ...(is_home_service !== undefined ? { is_home_service } : {})
    };
    const result = await services.findOneAndUpdate(
      { _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    res.json(formatDoc(result.value));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete service
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const services = await collection('services');
    const own = await services.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!own) return res.status(403).json({ message: 'Forbidden' });
    await services.updateOne({ _id: toObjectId(req.params.id) }, { $set: { is_active: false } });
    res.json({ message: 'Service deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
