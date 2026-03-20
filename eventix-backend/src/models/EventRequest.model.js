// ============================================
// EVENT REQUEST MODEL - Pending event creation requests
// ============================================
// Users submit requests, admins approve, then user pays to create event

const mongoose = require("mongoose");

const eventRequestSchema = new mongoose.Schema(
  {
    // ─── Basic Event Info ────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // ─── Duration Type ─────────────────────────────────────
    // "single-day" → one date  |  "multi-day" → start + end
    eventType: {
      type: String,
      enum: ["single-day", "multi-day"],
      default: "single-day",
    },

    // Start date (and only date for single-day events)
    eventDate: {
      type: Date,
      required: true,
    },

    // End date — required only for multi-day events
    endDate: {
      type: Date,
    },

    // ─── Pass Options (multi-day events only) ───────────────
    passOptions: {
      dailyPass: {
        enabled: { type: Boolean, default: false },
        price:   { type: Number, min: 0, default: 0 },
      },
      seasonPass: {
        enabled: { type: Boolean, default: false },
        price:   { type: Number, min: 0, default: 0 },
      },
    },

    // ─── Capacity & Visibility ──────────────────────────────
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "Total seats must be at least 1"],
    },

    type: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    // ─── Category ──────────────────────────────────────────
    category: [
      {
        type: String,
        enum: [
          "food-drink",
          "festivals-cultural",
          "dance-party",
          "sports-live",
          "arts-theater",
          "comedy-standup",
          "movies-premieres",
          "concerts-music",
        ],
      },
    ],

    // ─── Pricing ────────────────────────────────────────────
    // For single-day: price per ticket
    // For multi-day:  use passOptions; amount stays 0
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    // ─── Image ──────────────────────────────────────────────
    image: {
      type: String, // Base64 encoded image
    },

    // ─── Request Tracking ───────────────────────────────────
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",          // Waiting for admin review
        "APPROVED",         // Admin approved, waiting for payment
        "REJECTED",         // Admin rejected
        "PAYMENT_PENDING",  // User initiated payment
        "COMPLETED",        // Payment done, event created
        "EXPIRED",          // Payment window expired
      ],
      default: "PENDING",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: {
      type: Date,
    },

    adminNote: {
      type: String,
    },

    // ─── Platform Fee ───────────────────────────────────────
    platformFee: {
      type: Number,
      default: 5000, // ₹5000 default
    },

    // ─── Payment Details ────────────────────────────────────
    razorpayOrderId: {
      type: String,
    },

    razorpayPaymentId: {
      type: String,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },

    // 48-hour payment window after approval
    paymentExpiresAt: {
      type: Date,
    },

    // ─── Created Event Reference ────────────────────────────
    createdEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },

    // ─── Idempotency ────────────────────────────────────────
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls
    },
  },
  { timestamps: true },
);

// Indexes for efficient queries
eventRequestSchema.index({ status: 1, createdAt: -1 });
eventRequestSchema.index({ requestedBy: 1 });

module.exports = mongoose.model("EventRequest", eventRequestSchema);
