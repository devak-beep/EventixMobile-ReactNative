// ============================================
// CANCELLATION CONTROLLER
// ============================================

const mongoose   = require("mongoose");
const Booking    = require("../models/Booking.model");
const SeatLock   = require("../models/SeatLock.model");
const { BOOKING_STATUS, canTransition } = require("../utils/bookingStateMachine");
const {
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  toDateKey,
} = require("../utils/seatManager");

// ─── POST /api/bookings/:bookingId/cancel ────────────────────────────────────
exports.cancelBooking = async (req, res) => {
  const { bookingId }  = req.params;
  const correlationId  = req.headers["x-correlation-id"] || `cancel-${Date.now()}`;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Only CONFIRMED bookings can be cancelled
    if (!canTransition(booking.status, BOOKING_STATUS.CANCELLED)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking in ${booking.status} state. Only CONFIRMED bookings can be cancelled.`,
      });
    }

    // ── 50% refund calculation ─────────────────────────────────────────────
    const originalAmount  = booking.amount || 0;
    const refundAmount    = Math.floor(originalAmount * 0.5);
    const cancellationFee = originalAmount - refundAmount;

    booking.status       = BOOKING_STATUS.CANCELLED;
    booking.refundAmount = refundAmount;
    await booking.save({ session });

    // ── Restore seats based on passType ───────────────────────────────────
    if (booking.seatLockId) {
      const lock = await SeatLock.findById(booking.seatLockId).session(session);

      if (lock) {
        if (lock.passType === "regular") {
          await restoreSeats(lock.eventId, lock.seats, session);
        } else if (lock.passType === "daily") {
          const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
          if (dateKey) {
            await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
          } else {
            console.warn(`[CANCELLATION] daily lock ${lock._id} has no selectedDate`);
          }
        } else if (lock.passType === "season") {
          await restoreSeasonSeats(lock.eventId, lock.seats, session);
        }

        lock.status = "CANCELLED";
        await lock.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        id:     booking._id,
        status: booking.status,
        event:  booking.event,
        user:   booking.user,
        seats:  booking.seats,
      },
      originalAmount,
      refundAmount,
      cancellationFee,
      correlationId,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "Booking cancellation failed",
      error: error.message,
      correlationId,
    });
  }
};
