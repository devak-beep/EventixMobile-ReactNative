const Booking = require("../models/Booking.model");
const {
  confirmBookingTransactional,
} = require("../services/bookingConfirmation.service");

// GET all bookings or filter by eventId
exports.getAllBookings = async (req, res) => {
  try {
    const { eventId } = req.query;

    // Build filter based on query parameters
    const filter = {};
    if (eventId) {
      filter.event = eventId;
    }

    const bookings = await Booking.find(filter)
      .populate("user", "name email _id")
      .populate("event", "name totalSeats availableSeats image amount _id createdBy approvedBy")
      .populate("seatLockId", "status seats expiresAt")
      .sort({ createdAt: -1 }); // Sort by most recent first

    res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length,
      filter: eventId ? { event: eventId } : null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

// GET booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // If id looks like a booking ID (not a lock ID like "confirm")
    if (id === "confirm") {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await Booking.findById(id)
      .populate("user", "name email")
      .populate("event", "name totalSeats availableSeats image");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching booking",
      error: error.message,
    });
  }
};

exports.confirmBooking = async (req, res) => {
  try {
    // Support both: POST /api/bookings/confirm (body) and POST /api/bookings/:id/confirm (URL)
    const lockId = req.body.lockId || req.params.id;

    if (!lockId) {
      return res.status(400).json({
        success: false,
        message: "lockId is required (in body or URL)",
      });
    }

    const booking = await confirmBookingTransactional(
      lockId,
      req.correlationId,
    );

    res.status(201).json({
      success: true,
      booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
