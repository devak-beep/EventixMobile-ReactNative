// ============================================
// EVENT MODEL - Database schema for events
// ============================================

const mongoose = require("mongoose");

// Define what fields an Event document should have
const eventSchema = new mongoose.Schema(
  {
    // FIELD: Event name
    name: {
      type: String,
      required: true, // Event must have a name
      trim: true, // Remove whitespace
    },

    // FIELD: Event description (optional, provides details about the event)
    description: {
      type: String,
      trim: true,
    },

    // FIELD: When the event happens (date and time)
    // For single-day events, this is the event date
    // For multi-day events, this is the start date
    eventDate: {
      type: Date,
      required: true, // Event date is mandatory
      index: true, // Create database index for faster searches
    },

    // FIELD: Event duration type
    eventType: {
      type: String,
      enum: ["single-day", "multi-day"],
      default: "single-day",
      required: true,
    },

    // FIELD: End date for multi-day events
    endDate: {
      type: Date,
      required: function () {
        return this.eventType === "multi-day";
      },
      validate: {
        validator: function (value) {
          if (this.eventType === "multi-day") {
            return value && value >= this.eventDate;
          }
          return true;
        },
        message: "End date must be after or equal to start date",
      },
    },

    // FIELD: Pass options for multi-day events
    passOptions: {
      dailyPass: {
        enabled: {
          type: Boolean,
          default: false,
        },
        price: {
          type: Number,
          min: 0,
        },
      },
      seasonPass: {
        enabled: {
          type: Boolean,
          default: false,
        },
        price: {
          type: Number,
          min: 0,
        },
      },
    },

    // FIELD: Per-day seat availability for multi-day events
    // Structure: { "2026-03-06": { total: 10, available: 8 }, "2026-03-07": { total: 10, available: 10 } }
    dailySeats: {
      type: Map,
      of: {
        total: { type: Number, min: 0 },
        available: { type: Number, min: 0 },
      },
      default: {},
    },

    // FIELD: Total number of seats available for this event
    totalSeats: {
      type: Number,
      required: true,
      // Validation: minimum 1 seat required
      min: [1, "Total seats must be at least 1"],
    },

    // FIELD: How many seats are still available (not booked/locked)
    // Decreases when users lock/book seats
    // Increases when locks/bookings expire
    availableSeats: {
      type: Number,
      required: true,
      // Validation: seats cannot be negative
      min: [0, "Available seats cannot be negative"],
      // Custom validation: available cannot exceed total
      validate: {
        validator: function (value) {
          return value <= this.totalSeats;
        },
        message: "Available seats cannot exceed total seats",
      },
    },

    // FIELD: Event type (public or private)
    // Public events are shown on home page
    // Private events can only be accessed by ID
    type: {
      type: String,
      enum: ["public", "private"], // Only these two values allowed
      default: "public", // Default to public if not specified
    },

    // FIELD: Event category
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

    // FIELD: Ticket price per seat (in smallest currency unit, e.g., cents/paise)
    // Store as integer to avoid floating point issues
    // For payment gateway integration
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },

    // FIELD: Currency code (ISO 4217)
    // Default to INR for Indian Rupees
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    // FIELD: Event creation charge (platform fee)
    creationCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    // FIELD: User who created this event (the requester)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // FIELD: Admin/SuperAdmin who approved this event request
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // FIELD: Whether this event was created via request flow
    createdViaRequest: {
      type: Boolean,
      default: false,
    },

    // FIELD: Reference to the original event request
    eventRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRequest",
    },

    // FIELD: Event image (base64 encoded or URL)
    image: {
      type: String,
      default: null,
    },

    // FIELD: Idempotency key for duplicate prevention
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls
    },

    // FIELD: Payment status for event creation
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },

    // FIELD: Razorpay order ID for event creation
    razorpayOrderId: {
      type: String,
    },

    // FIELD: Razorpay payment ID for event creation
    razorpayPaymentId: {
      type: String,
    },

    // FIELD: Event creation fee paid
    creationFee: {
      type: Number,
      default: 0,
    },

    // FIELD: Whether event is published (after payment)
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  // Add automatic timestamps
  {
    timestamps: true,
    // Transform Map to plain object when converting to JSON
    toJSON: {
      transform: function (doc, ret) {
        // Convert dailySeats Map to plain object
        if (ret.dailySeats instanceof Map) {
          ret.dailySeats = Object.fromEntries(ret.dailySeats);
        }
        return ret;
      },
    },
  },
);

// Create and export Event model
// MongoDB will create an "events" collection
module.exports = mongoose.model("Event", eventSchema);
