const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking.model");
const Event = require("../models/Event.model");
const SeatLock = require("../models/SeatLock.model");
const { BOOKING_STATUS } = require("../utils/bookingStateMachine");

// GET /api/reports/booking-summary - Get booking metrics
router.get("/booking-summary", async (req, res) => {
  try {
    const { eventId, startDate, endDate } = req.query;
    
    // Build filter
    const filter = {};
    if (eventId) filter.event = eventId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Get booking counts by status
    const bookingStats = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSeats: { $sum: { $size: "$seats" } }
        }
      }
    ]);

    // Calculate totals
    let total = 0;
    let confirmed = 0;
    let expired = 0;
    let totalSeatsBooked = 0;

    bookingStats.forEach(stat => {
      total += stat.count;
      totalSeatsBooked += stat.totalSeats;
      
      if (stat._id === BOOKING_STATUS.CONFIRMED) {
        confirmed = stat.count;
      } else if (stat._id === BOOKING_STATUS.EXPIRED) {
        expired = stat.count;
      }
    });

    // Calculate seat utilization
    let seatUtilization = 0;
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) {
        seatUtilization = ((event.totalSeats - event.availableSeats) / event.totalSeats * 100).toFixed(2);
      }
    } else {
      // Overall utilization across all events
      const events = await Event.aggregate([
        {
          $group: {
            _id: null,
            totalSeats: { $sum: "$totalSeats" },
            availableSeats: { $sum: "$availableSeats" }
          }
        }
      ]);
      
      if (events.length > 0) {
        const { totalSeats, availableSeats } = events[0];
        seatUtilization = ((totalSeats - availableSeats) / totalSeats * 100).toFixed(2);
      }
    }

    res.json({
      success: true,
      data: {
        bookings: {
          total,
          confirmed,
          expired,
          pending: total - confirmed - expired
        },
        seats: {
          totalBooked: totalSeatsBooked,
          utilizationPercentage: parseFloat(seatUtilization)
        },
        filters: {
          eventId: eventId || null,
          dateRange: {
            start: startDate || null,
            end: endDate || null
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/reports/health-metrics - Get system health indicators
router.get("/health-metrics", async (req, res) => {
  try {
    const { eventId, hours = 24 } = req.query;
    const timeFilter = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Build base filter
    const baseFilter = { createdAt: { $gte: timeFilter } };
    if (eventId) baseFilter.eventId = eventId;

    // 1. Lock expiry rate
    const totalLocks = await SeatLock.countDocuments(baseFilter);
    const expiredLocks = await SeatLock.countDocuments({
      ...baseFilter,
      expiresAt: { $lt: new Date() }
    });
    const lockExpiryRate = totalLocks > 0 ? ((expiredLocks / totalLocks) * 100).toFixed(2) : 0;

    // 2. Payment success/failure rate
    const bookingFilter = { createdAt: { $gte: timeFilter } };
    if (eventId) bookingFilter.event = eventId;

    const paymentStats = await Booking.aggregate([
      { $match: bookingFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    let totalPaymentAttempts = 0;
    let successfulPayments = 0;
    let failedPayments = 0;

    paymentStats.forEach(stat => {
      totalPaymentAttempts += stat.count;
      
      if (stat._id === BOOKING_STATUS.CONFIRMED) {
        successfulPayments = stat.count;
      } else if (stat._id === BOOKING_STATUS.EXPIRED || stat._id === BOOKING_STATUS.CANCELLED) {
        failedPayments += stat.count;
      }
    });

    const paymentSuccessRate = totalPaymentAttempts > 0 ? 
      ((successfulPayments / totalPaymentAttempts) * 100).toFixed(2) : 0;
    const paymentFailureRate = totalPaymentAttempts > 0 ? 
      ((failedPayments / totalPaymentAttempts) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        timeWindow: `${hours} hours`,
        eventId: eventId || "all events",
        metrics: {
          locks: {
            total: totalLocks,
            expired: expiredLocks,
            expiryRate: parseFloat(lockExpiryRate)
          },
          payments: {
            totalAttempts: totalPaymentAttempts,
            successful: successfulPayments,
            failed: failedPayments,
            successRate: parseFloat(paymentSuccessRate),
            failureRate: parseFloat(paymentFailureRate)
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
