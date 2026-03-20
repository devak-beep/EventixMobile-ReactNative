// ============================================
// BOOKING MODEL - Database schema for bookings
// ============================================

const mongoose = require("mongoose");

// Define all possible booking statuses
const BOOKING_STATUS = {
  INITIATED: "INITIATED",         // Booking just started (lock created)
  PAYMENT_PENDING: "PAYMENT_PENDING", // Waiting for payment
  CONFIRMED: "CONFIRMED",         // Payment received, booking confirmed
  CANCELLED: "CANCELLED",         // User cancelled the booking
  EXPIRED: "EXPIRED",             // Payment time expired
  FAILED: "FAILED",               // Payment failed
};

const bookingSchema = new mongoose.Schema(
  {
    // FIELD: Which user made this booking
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // FIELD: Which event is being booked
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // FIELD: Idempotency key for duplicate prevention
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    // FIELD: Seat numbers (array of seat identifiers)
    seats: {
      type: [String],
      required: true,
    },

    // FIELD: Pass type
    //   "regular" – single-day event (no pass concept)
    //   "daily"   – multi-day event, one day selected
    //   "season"  – multi-day event, all days
    passType: {
      type: String,
      enum: ["regular", "daily", "season"],
      default: "regular",
    },

    // FIELD: Selected date for daily pass (multi-day events only)
    selectedDate: {
      type: Date,
      required: function () {
        return this.passType === "daily";
      },
    },

    // FIELD: Current booking status
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.INITIATED,
    },

    // FIELD: Link to the SeatLock that reserved these seats
    seatLockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeatLock",
      unique: true,
    },

    // FIELD: When must payment be completed
    paymentExpiresAt: {
      type: Date,
      required: false,
    },

    // FIELD: Payment amount for this booking (in rupees)
    amount: {
      type: Number,
      required: false,
      min: 0,
    },

    // FIELD: Refund amount (if cancelled / failed)
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // FIELD: Razorpay order ID
    razorpayOrderId: {
      type: String,
      required: false,
    },

    // FIELD: Razorpay payment ID
    razorpayPaymentId: {
      type: String,
      required: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
