const express = require("express");
const { expireLocks } = require("../jobs/lockExpiry.job");
const { expireBookings } = require("../jobs/bookingExpiry.job");
const { recoverFromFailures } = require("../jobs/failureRecovery.job");
const { fixEventSeats } = require("../utils/seatManager");
const Event = require("../models/Event.model");

const router = express.Router();

// Trigger lock expiry job
router.post("/expire-locks", async (req, res) => {
  try {
    await expireLocks();
    res.json({ success: true, message: "Lock expiry job completed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger booking expiry job
router.post("/expire-bookings", async (req, res) => {
  try {
    await expireBookings();
    res.json({ success: true, message: "Booking expiry job completed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger failure recovery job
router.post("/recover", async (req, res) => {
  try {
    await recoverFromFailures();
    res.json({ success: true, message: "Failure recovery job completed" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fix corrupted event seat counts
router.post("/fix-seats", async (req, res) => {
  try {
    const { eventId } = req.body;

    let results = [];

    if (eventId) {
      // Fix single event
      const result = await fixEventSeats(eventId);
      results.push({ eventId, ...result });
    } else {
      // Fix all events
      const events = await Event.find({});
      for (const event of events) {
        const result = await fixEventSeats(event._id);
        if (result.corrected) {
          results.push({ eventId: event._id, name: event.name, ...result });
        }
      }
    }

    res.json({
      success: true,
      message: `Fixed ${results.filter((r) => r.corrected).length} events`,
      results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
