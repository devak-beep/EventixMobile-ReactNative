const mongoose = require("mongoose");

// Job execution tracking to prevent duplicate runs
const jobExecutionSchema = new mongoose.Schema(
  {
    // Type of job
    jobType: {
      type: String,
      enum: [
        "EXPIRE_LOCKS",
        "EXPIRE_BOOKINGS",
        "FAILURE_RECOVERY",
        "DELETE_EXPIRED_EVENTS",
      ],
      required: true,
    },

    // Current status
    status: {
      type: String,
      enum: ["RUNNING", "COMPLETED", "FAILED"],
      default: "RUNNING",
    },

    // When job started
    startedAt: {
      type: Date,
      default: Date.now,
    },

    // When job completed
    completedAt: {
      type: Date,
      required: false,
    },

    // Job results
    results: {
      processed: { type: Number, default: 0 },
      eventsDeleted: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
      details: { type: String, required: false },
    },

    // Auto-expire after 1 hour (prevent stale locks)
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // 1 hour in seconds
    },
  },
  { timestamps: true },
);

// Compound index for job type and status
jobExecutionSchema.index({ jobType: 1, status: 1 });

module.exports = mongoose.model("JobExecution", jobExecutionSchema);
