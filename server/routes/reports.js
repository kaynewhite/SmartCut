const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// Submit a report/feedback
router.post('/', authenticate, async (req, res) => {
  try {
    const { report_type, target_type, target_id, subject, message } = req.body;
    if (!subject || !message || !report_type) return res.status(400).json({ message: 'Missing required fields' });
    const result = await pool.query(
      `INSERT INTO feedback_reports (reporter_type, reporter_id, report_type, target_type, target_id, subject, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.type, req.user.id, report_type, target_type || null, target_id || null, subject, message]
    );
    const admins = await pool.query('SELECT id FROM admins LIMIT 5');
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('admin',$1,'New Report/Feedback',$2,'report')`,
        [admin.id, `${req.user.type} submitted a ${report_type}: ${subject}`]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Get own reports
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM feedback_reports WHERE reporter_type=$1 AND reporter_id=$2 ORDER BY created_at DESC`,
      [req.user.type, req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
