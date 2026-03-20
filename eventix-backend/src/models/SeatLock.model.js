// ============================================
// SEAT LOCK MODEL - Temporary seat reservations
// ============================================
const mongoose = require("mongoose");

const seatLockSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Number of seats locked (per day for daily pass, per day for season pass)
    seats: {
      type: Number,
      required: true,
      min: 1,
    },
    // Pass type determines how seats are tracked and restored
    // "regular"  → single-day event  (uses event.availableSeats)
    // "daily"    → multi-day event, one specific day (uses dailySeats[selectedDate])
    // "season"   → multi-day event, all days (uses all dailySeats entries)
    passType: {
      type: String,
      enum: ["regular", "daily", "season"],
      default: "regular",
    },
    // The date selected (YYYY-MM-DD) for daily pass locks only
    selectedDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CONSUMED", "CANCELLED"],
      default: "ACTIVE",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

seatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (mongoose.models.SeatLock) delete mongoose.models.SeatLock;

module.exports = mongoose.model("SeatLock", seatLockSchema);
