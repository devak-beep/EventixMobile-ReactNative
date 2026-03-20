const express = require("express");
const router = express.Router();
const Audit = require("../models/Audit.model");

// GET /api/audit - Get all audit records
router.get("/", async (req, res) => {
  try {
    const { bookingId, eventId, action, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (bookingId) filter.bookingId = bookingId;
    if (eventId) filter.eventId = eventId;
    if (action) filter.action = action;

    const audits = await Audit.find(filter)
      .populate('bookingId', 'status seats')
      .populate('eventId', 'name eventDate')
      .populate('metadata.userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Audit.countDocuments(filter);

    res.json({
      success: true,
      data: audits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/audit/:bookingId - Get audit trail for specific booking
router.get("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const audits = await Audit.find({ bookingId })
      .populate('eventId', 'name eventDate')
      .populate('metadata.userId', 'name email')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: audits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
