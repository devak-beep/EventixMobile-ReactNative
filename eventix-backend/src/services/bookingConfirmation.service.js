// ============================================
// BOOKING CONFIRMATION SERVICE
// Transactional booking creation from a SeatLock
// ============================================

const mongoose = require("mongoose");
const SeatLock  = require("../models/SeatLock.model");
const Booking   = require("../models/Booking.model");
const Event     = require("../models/Event.model");
const { BOOKING_STATUS }     = require("../utils/bookingStateMachine");
const { logBookingStateChange } = require("../utils/logger");
const {
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  toDateKey,
} = require("../utils/seatManager");

/**
 * Called after a SeatLock is created.
 * Creates a Booking in PAYMENT_PENDING state, copying passType / selectedDate
 * from the lock so that subsequent seat-restoration code has full context.
 */
async function confirmBookingTransactional(lockId, correlationId = null) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Validate lock ──────────────────────────────────────────────────
    const lock = await SeatLock.findById(lockId).session(session);

    if (!lock) {
      throw new Error("INVALID_OR_EXPIRED_LOCK");
    }

    // ── 2. Check lock expiry ──────────────────────────────────────────────
    if (lock.expiresAt < new Date()) {
      // Restore seats based on passType before deleting the lock
      if (lock.passType === "regular") {
        await restoreSeats(lock.eventId, lock.seats, session);
      } else if (lock.passType === "daily") {
        const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
        if (dateKey) await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
      } else if (lock.passType === "season") {
        await restoreSeasonSeats(lock.eventId, lock.seats, session);
      }

      await SeatLock.deleteOne({ _id: lockId }).session(session);
      throw new Error("LOCK_EXPIRED");
    }

    // ── 3. Idempotency check ──────────────────────────────────────────────
    const existingBooking = await Booking.findOne({ seatLockId: lockId }).session(session);
    if (existingBooking) {
      await session.commitTransaction();
      session.endSession();
      return existingBooking;
    }

    // ── 4. Build booking payload ──────────────────────────────────────────
    const bookingData = {
      event:            lock.eventId,
      user:             lock.userId,
      seats:            Array.from({ length: lock.seats }, (_, i) => `SEAT-${i + 1}`),
      seatLockId:       lockId,
      passType:         lock.passType,   // "regular" | "daily" | "season"
      status:           BOOKING_STATUS.PAYMENT_PENDING,
      paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    };

    // Copy selectedDate for daily pass
    if (lock.passType === "daily" && lock.selectedDate) {
      bookingData.selectedDate = lock.selectedDate;
    }

    // ── 5. Create booking ─────────────────────────────────────────────────
    const booking = await Booking.create([bookingData], { session });

    await session.commitTransaction();
    session.endSession();

    // Log booking creation (outside transaction to avoid deadlock)
    await logBookingStateChange(
      booking[0]._id,
      null,
      BOOKING_STATUS.PAYMENT_PENDING,
      lock.userId,
      correlationId,
      lock.eventId,
      "BOOKING_CREATED",
    );

    return booking[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

module.exports = { confirmBookingTransactional };
