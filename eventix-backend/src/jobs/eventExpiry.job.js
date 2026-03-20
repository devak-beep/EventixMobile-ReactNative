const mongoose = require("mongoose");
const Event = require("../models/Event.model");
const Booking = require("../models/Booking.model");
const SeatLock = require("../models/SeatLock.model");
const JobExecution = require("../models/JobExecution.model");

const EVENT_EXPIRY_INTERVAL_MINUTES = 60; // Run every hour
const EVENT_EXPIRY_DAYS = 2; // Delete events 2 days after expiry

/**
 * TASK - Event Expiry Cleanup Job
 *
 * Automatically delete expired events 2 days after they end
 * This keeps the database clean and removes old events
 *
 * Acceptance Criteria:
 * ✅ Events with eventDate > 2 days ago are deleted
 * ✅ Related bookings are also deleted
 * ✅ Related seat locks are cleaned up
 * ✅ Job execution is logged
 */
async function deleteExpiredEvents() {
  // 1️⃣ Job safety check - prevent duplicate execution
  const existingJob = await JobExecution.findOne({
    jobType: "DELETE_EXPIRED_EVENTS",
    status: "RUNNING",
  });

  if (existingJob) {
    console.log(
      "[EVENT EXPIRY JOB] Another instance is already running, skipping...",
    );
    return;
  }

  // 2️⃣ Create job execution record
  const jobExecution = await JobExecution.create({
    jobType: "DELETE_EXPIRED_EVENTS",
    status: "RUNNING",
    startedAt: new Date(),
  });

  const session = await mongoose.startSession();

  try {
    const now = new Date();

    // Calculate the cutoff date (2 days ago)
    const cutoffDate = new Date(
      now.getTime() - EVENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    // 3️⃣ Find events that expired 2 days ago
    // Events where eventDate is in the past AND more than 2 days have passed
    const expiredEvents = await Event.find({
      eventDate: { $lt: cutoffDate },
    });

    console.log(
      `[EVENT EXPIRY JOB] Found ${expiredEvents.length} events to delete`,
    );

    let deleted = 0;
    let errors = 0;

    // 4️⃣ Delete each expired event and its related data
    // Each event deletion uses its own transaction for atomicity
    for (const event of expiredEvents) {
      session.startTransaction();
      try {
        // Delete all bookings for this event
        await Booking.deleteMany({
          event: event._id,
        }).session(session);

        // Delete all seat locks for this event
        await SeatLock.deleteMany({
          eventId: event._id,
        }).session(session);

        // Delete the event itself
        await Event.findByIdAndDelete(event._id).session(session);

        await session.commitTransaction();
        deleted++;
        console.log(
          `[EVENT EXPIRY JOB] Deleted event: ${event.name} (${event._id})`,
        );
      } catch (error) {
        await session.abortTransaction();
        errors++;
        console.error(
          `[EVENT EXPIRY JOB] Error deleting event ${event._id}: ${error.message}`,
        );
      }
    }

    // 5️⃣ End session after all events processed
    session.endSession();

    // 6️⃣ Mark job as completed
    jobExecution.status = "COMPLETED";
    jobExecution.completedAt = new Date();
    jobExecution.results = {
      eventsDeleted: deleted,
      errors: errors,
      details: `Deleted ${deleted} events older than ${EVENT_EXPIRY_DAYS} days`,
    };
    await jobExecution.save();

    console.log(
      `[EVENT EXPIRY JOB] Successfully deleted ${deleted} expired events, ${errors} errors`,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Mark job as failed
    jobExecution.status = "FAILED";
    jobExecution.completedAt = new Date();
    jobExecution.results = {
      eventsDeleted: 0,
      errors: 1,
      details: error.message,
    };
    await jobExecution.save();

    console.error("[EVENT EXPIRY JOB ERROR]", error.message);
  }
}

// Only run interval in non-serverless (traditional server) environment
if (process.env.VERCEL !== "1") {
  setInterval(deleteExpiredEvents, EVENT_EXPIRY_INTERVAL_MINUTES * 60 * 1000);
}

module.exports = deleteExpiredEvents;
