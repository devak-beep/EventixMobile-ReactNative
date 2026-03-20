// ============================================
// LOCK EXPIRY JOB
// Automatically expire stale seat locks and restore seats
// ============================================

const mongoose      = require("mongoose");
const SeatLock      = require("../models/SeatLock.model");
const JobExecution  = require("../models/JobExecution.model");
const {
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  toDateKey,
} = require("../utils/seatManager");

const LOCK_EXPIRY_INTERVAL_MINUTES = 1;

async function expireLocks() {
  // ── Job safety: prevent concurrent runs ─────────────────────────────────
  const existingJob = await JobExecution.findOne({ jobType: "EXPIRE_LOCKS", status: "RUNNING" });
  if (existingJob) {
    console.log("[LOCK EXPIRY JOB] Already running – skipping");
    return;
  }

  const jobExecution = await JobExecution.create({
    jobType: "EXPIRE_LOCKS",
    status:  "RUNNING",
    startedAt: new Date(),
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();

    const expiredLocks = await SeatLock.find({
      status:    "ACTIVE",
      expiresAt: { $lt: now },
    }).session(session);

    console.log(`[LOCK EXPIRY JOB] Found ${expiredLocks.length} expired lock(s)`);

    if (expiredLocks.length === 0) {
      await session.commitTransaction();
      session.endSession();
      jobExecution.status = "COMPLETED";
      jobExecution.completedAt = new Date();
      jobExecution.results = { processed: 0, errors: 0, details: "No expired locks" };
      await jobExecution.save();
      return;
    }

    let processed = 0;
    let errors    = 0;

    for (const lock of expiredLocks) {
      try {
        lock.status = "EXPIRED";
        await lock.save({ session });

        // ── Restore seats by passType ──────────────────────────────────────
        if (lock.passType === "regular") {
          await restoreSeats(lock.eventId, lock.seats, session);
        } else if (lock.passType === "daily") {
          const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
          if (dateKey) {
            await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
          } else {
            console.warn(`[LOCK EXPIRY JOB] daily lock ${lock._id} has no selectedDate`);
          }
        } else if (lock.passType === "season") {
          await restoreSeasonSeats(lock.eventId, lock.seats, session);
        }

        console.log(`[LOCK EXPIRY JOB] Expired lock ${lock._id} (passType: ${lock.passType})`);
        processed++;
      } catch (err) {
        errors++;
        console.error(`[LOCK EXPIRY JOB] Error on lock ${lock._id}:`, err.message);
      }
    }

    await session.commitTransaction();
    session.endSession();

    jobExecution.status      = "COMPLETED";
    jobExecution.completedAt = new Date();
    jobExecution.results     = { processed, errors, details: `${processed} expired, ${errors} errors` };
    await jobExecution.save();

    console.log(`[LOCK EXPIRY JOB] Done – ${processed} expired, ${errors} error(s)`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    jobExecution.status      = "FAILED";
    jobExecution.completedAt = new Date();
    jobExecution.results     = { processed: 0, errors: 1, details: error.message };
    await jobExecution.save();

    console.error("[LOCK EXPIRY JOB] Fatal error:", error.message);
  }
}

if (process.env.VERCEL !== "1") {
  setInterval(expireLocks, LOCK_EXPIRY_INTERVAL_MINUTES * 60 * 1000);
}

module.exports = expireLocks;
