// ============================================
// BOOKING EXPIRY JOB
// Automatically expire unpaid bookings and release locks
// ============================================

const mongoose     = require("mongoose");
const Booking      = require("../models/Booking.model");
const SeatLock     = require("../models/SeatLock.model");
const JobExecution = require("../models/JobExecution.model");
const { BOOKING_STATUS } = require("../utils/bookingStateMachine");
const {
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  toDateKey,
} = require("../utils/seatManager");

const BOOKING_EXPIRY_INTERVAL_MINUTES = 1;

async function expireBookings() {
  // ── Job safety ────────────────────────────────────────────────────────────
  const existingJob = await JobExecution.findOne({ jobType: "EXPIRE_BOOKINGS", status: "RUNNING" });
  if (existingJob) {
    console.log("[BOOKING EXPIRY JOB] Already running – skipping");
    return;
  }

  const jobExecution = await JobExecution.create({
    jobType:   "EXPIRE_BOOKINGS",
    status:    "RUNNING",
    startedAt: new Date(),
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();

    const expiredBookings = await Booking.find({
      status:           BOOKING_STATUS.PAYMENT_PENDING,
      paymentExpiresAt: { $lt: now },
    }).session(session);

    console.log(`[BOOKING EXPIRY JOB] Found ${expiredBookings.length} expired booking(s)`);

    if (expiredBookings.length === 0) {
      await session.commitTransaction();
      session.endSession();
      jobExecution.status      = "COMPLETED";
      jobExecution.completedAt = new Date();
      jobExecution.results     = { processed: 0, errors: 0, details: "No expired bookings" };
      await jobExecution.save();
      return;
    }

    let processed = 0;
    let errors    = 0;

    for (const booking of expiredBookings) {
      try {
        // Mark booking expired + issue refund if charged
        booking.status = BOOKING_STATUS.EXPIRED;
        if (booking.amount && booking.amount > 0) {
          booking.refundAmount = booking.amount;
        }
        await booking.save({ session });

        // Release associated lock and restore seats
        if (booking.seatLockId) {
          const lock = await SeatLock.findById(booking.seatLockId).session(session);

          if (lock && lock.status === "ACTIVE") {
            lock.status = "EXPIRED";
            await lock.save({ session });

            // ── Restore seats by passType ────────────────────────────────
            if (lock.passType === "regular") {
              await restoreSeats(lock.eventId, lock.seats, session);
            } else if (lock.passType === "daily") {
              const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
              if (dateKey) {
                await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
              } else {
                console.warn(`[BOOKING EXPIRY JOB] daily lock ${lock._id} has no selectedDate`);
              }
            } else if (lock.passType === "season") {
              await restoreSeasonSeats(lock.eventId, lock.seats, session);
            }

            console.log(
              `[BOOKING EXPIRY JOB] Expired booking ${booking._id}, lock ${lock._id} (passType: ${lock.passType})`,
            );
          }
        }

        processed++;
      } catch (err) {
        errors++;
        console.error(`[BOOKING EXPIRY JOB] Error on booking ${booking._id}:`, err.message);
      }
    }

    await session.commitTransaction();
    session.endSession();

    jobExecution.status      = "COMPLETED";
    jobExecution.completedAt = new Date();
    jobExecution.results     = { processed, errors, details: `${processed} expired, ${errors} errors` };
    await jobExecution.save();

    console.log(`[BOOKING EXPIRY JOB] Done – ${processed} expired, ${errors} error(s)`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    jobExecution.status      = "FAILED";
    jobExecution.completedAt = new Date();
    jobExecution.results     = { processed: 0, errors: 1, details: error.message };
    await jobExecution.save();

    console.error("[BOOKING EXPIRY JOB] Fatal error:", error.message);
  }
}

if (process.env.VERCEL !== "1") {
  setInterval(expireBookings, BOOKING_EXPIRY_INTERVAL_MINUTES * 60 * 1000);
}

module.exports = { expireBookings };
