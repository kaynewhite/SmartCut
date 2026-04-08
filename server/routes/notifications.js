const express = require('express');
const router = express.Router();
const { collection, toObjectId, formatDocs } = require('../db');
const { authenticate } = require('../middleware/auth');

// Get notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await collection('notifications');
    const items = await notifications
      .find({ recipient_type: req.user.type, recipient_id: req.user.id })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();
    res.json(formatDocs(items));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notifications = await collection('notifications');
    await notifications.updateOne(
      { _id: toObjectId(req.params.id), recipient_type: req.user.type, recipient_id: req.user.id },
      { $set: { is_read: true } }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const notifications = await collection('notifications');
    await notifications.updateMany(
      { recipient_type: req.user.type, recipient_id: req.user.id },
      { $set: { is_read: true } }
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
