// ============================================
// SERVER STARTUP - Main entry point for the application
// ============================================

// Load environment variables from .env file into process.env
// This makes PORT, MONGO_URI, NODE_ENV available throughout the app
require("dotenv").config();

// Import Express app (contains all routes and configuration)
const app = require("./app");

// Import MongoDB connection function
const connectDB = require("./config/db");

// EPIC 6: Import all background jobs
// These jobs run automatically every 1 minute to clean up expired data
const recoverFromFailures = require("./jobs/failureRecovery.job"); // Runs once on startup
const expireBookings = require("./jobs/bookingExpiry.job"); // Runs every 1 minute
const expireLocks = require("./jobs/lockExpiry.job"); // Runs every 1 minute
const deleteExpiredEvents = require("./jobs/eventExpiry.job"); // Runs every 60 minutes

// Get server port from .env file, default to 3000 if not set
const PORT = process.env.PORT || 3000;

/**
 * FUNCTION: Start server
 * Purpose: Initialize database, run recovery, start jobs, and listen for requests
 * Called: When this file is executed (npm start or npm run dev)
 */
const startServer = async () => {
  // STEP 1️⃣: CONNECT TO DATABASE
  // Wait for MongoDB connection before proceeding
  // If connection fails, process exits with error code 1
  await connectDB();

  // STEP 2️⃣: RUN FAILURE RECOVERY JOB
  // On startup, check for broken state from previous crashes
  // Fix stale locks/bookings that weren't cleaned up
  try {
    await recoverFromFailures();
  } catch (error) {
    // If recovery fails, log but continue
    // Background jobs will handle cleanup every minute anyway
    console.error(
      "Failed to complete recovery, proceeding with startup...",
      error.message,
    );
  }

  // STEP 3️⃣: LOG JOB START
  // Background jobs are scheduled in their respective files using cron
  // They run automatically every 1 minute
  console.log("[JOBS] Lock expiry job started (runs every 1 minute)");
  console.log("[JOBS] Booking expiry job started (runs every 1 minute)");
  console.log("[JOBS] Event expiry job started (runs every 60 minutes)");

  // STEP 4️⃣: START EXPRESS SERVER
  // Listen for incoming HTTP requests on the specified PORT
  // Once started, server can accept API requests
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Execute the startup function when this file runs
startServer();
