const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDoc, formatDocs } = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `pm_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET payment methods for a barbershop (public)
router.get('/barbershop/:barbershopId', async (req, res) => {
  try {
    const paymentMethods = await collection('payment_methods');
    const items = await paymentMethods
      .find({ barbershop_id: toObjectId(req.params.barbershopId), is_active: true })
      .sort({ _id: 1 })
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET my barbershop's payment methods (owner)
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const paymentMethods = await collection('payment_methods');
    const items = await paymentMethods
      .find({ barbershop_id: toObjectId(req.user.id) })
      .sort({ _id: 1 })
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST add a payment method
router.post('/me', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  try {
    const { type, account_name, account_number } = req.body;
    if (!type) return res.status(400).json({ message: 'Payment type required' });
    const qr_code_url = req.file ? `/uploads/${req.file.filename}` : null;
    const paymentMethods = await collection('payment_methods');
    const methodDoc = {
      barbershop_id: toObjectId(req.user.id),
      type,
      account_name: account_name || null,
      account_number: account_number || null,
      qr_code_url,
      is_active: true,
      created_at: new Date()
    };
    const result = await paymentMethods.insertOne(methodDoc);
    res.status(201).json(formatDoc({ ...methodDoc, _id: result.insertedId }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update a payment method
router.put('/me/:id', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  try {
    const { type, account_name, account_number, is_active } = req.body;
    const paymentMethods = await collection('payment_methods');
    const existing = await paymentMethods.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!existing) return res.status(404).json({ message: 'Not found' });
    const qr_code_url = req.file ? `/uploads/${req.file.filename}` : existing.qr_code_url;
    const update = {
      type: type || existing.type,
      account_name: account_name ?? existing.account_name,
      account_number: account_number ?? existing.account_number,
      qr_code_url,
      is_active: is_active !== undefined ? is_active : existing.is_active
    };
    const result = await paymentMethods.findOneAndUpdate(
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

// DELETE a payment method
router.delete('/me/:id', authenticateBarbershop, async (req, res) => {
  try {
    const paymentMethods = await collection('payment_methods');
    const result = await paymentMethods.findOneAndDelete({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!result.value) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH toggle active status
router.patch('/me/:id/toggle', authenticateBarbershop, async (req, res) => {
  try {
    const paymentMethods = await collection('payment_methods');
    const existing = await paymentMethods.findOne({ _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) });
    if (!existing) return res.status(404).json({ message: 'Not found' });
    const result = await paymentMethods.findOneAndUpdate(
      { _id: toObjectId(req.params.id), barbershop_id: toObjectId(req.user.id) },
      { $set: { is_active: !existing.is_active } },
      { returnDocument: 'after' }
    );
    res.json(formatDoc(result.value));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
