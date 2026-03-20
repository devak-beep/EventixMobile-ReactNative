const mongoose = require("mongoose");

// Payment attempt tracking for idempotency
const paymentAttemptSchema = new mongoose.Schema(
  {
    // Unique key for idempotency
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },

    // Which booking this payment is for
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    // Payment amount
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Force result for simulation
    forceResult: {
      type: String,
      enum: ["success", "failure", "timeout"],
      required: true,
    },

    // Payment status
    status: {
      type: String,
      enum: ["PROCESSING", "SUCCESS", "FAILED", "TIMEOUT"],
      default: "PROCESSING",
    },

    // Stored response for idempotency
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    // Correlation ID for tracking
    correlationId: {
      type: String,
      required: false,
    },

    // Auto-expire after 24 hours
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentAttempt", paymentAttemptSchema);
