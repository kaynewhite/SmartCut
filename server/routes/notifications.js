const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// Get notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE recipient_type=$1 AND recipient_id=$2 ORDER BY created_at DESC LIMIT 50`,
      [req.user.type, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=true WHERE id=$1 AND recipient_type=$2 AND recipient_id=$3',
      [req.params.id, req.user.type, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=true WHERE recipient_type=$1 AND recipient_id=$2',
      [req.user.type, req.user.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
