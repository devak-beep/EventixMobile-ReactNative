const mongoose = require("mongoose");
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");
const Booking = require("../models/Booking.model");

exports.confirmBooking = async (req, res) => {
  try {
    const { lockId } = req.body;

    // ✅ Basic validation
    if (!lockId) {
      return res.status(400).json({
        success: false,
        message: "lockId is required",
      });
    }

    // 1️⃣ Validate lock existence
    const lock = await SeatLock.findById(lockId);
    if (!lock) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired lock",
      });
    }

    // 2️⃣ Check lock expiration
    if (lock.expiresAt < new Date()) {
      await SeatLock.findByIdAndDelete(lockId);
      return res.status(400).json({
        success: false,
        message: "Lock expired",
      });
    }

    // 3️⃣ Validate event existence
    const event = await Event.findById(lock.eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // 3a️⃣ Check if event has expired
    const eventDate = new Date(event.eventDate);
    const now = new Date();
    if (eventDate <= now) {
      return res.status(400).json({
        success: false,
        message: "Cannot confirm booking for expired event",
      });
    }

    // ⚠️ Seats are already handled in LOCK phase
    // Do NOT deduct seats again here

    // 4️⃣ Create booking (FIXED ObjectId + EPIC 5 STATUS)
    const booking = await Booking.create({
      event: lock.eventId,
      user: new mongoose.Types.ObjectId(lock.userId), // ✅ FIX
      seats: lock.seats,
      totalPrice: lock.seats * 100, // dummy pricing
      status: "PAYMENT_PENDING", // ✅ EPIC 5 alignment
    });

    // 5️⃣ Remove lock after successful booking
    await SeatLock.findByIdAndDelete(lockId);

    // 6️⃣ Send success response
    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Confirm Booking Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
