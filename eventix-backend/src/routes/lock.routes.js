// ============================================
// LOCK ROUTES - API endpoints for seat locking
// ============================================

// Import Express router
const express = require("express");
// Create router instance
const router = express.Router();

// Import controller functions
const { lockSeats, getAllLocks, cancelLock } = require("../controllers/lock.controller");

// ROUTE: POST /api/locks
// Purpose: Lock/reserve seats for a user
// Handler: lockSeats function
// Request body: {eventId, userId, seats, idempotencyKey}
// Response: {success: true, data: lock}
// Why: Creates a temporary lock on seats while user completes payment
// Expiration: Lock expires after 5 minutes if not used
router.post("/", lockSeats);

// ROUTE: GET /api/locks
// Purpose: View all locks
// Handler: getAllLocks function
// Response: [lock1, lock2, ...]
router.get("/", getAllLocks);

// ROUTE: POST /api/locks/:lockId/cancel
// Purpose: Cancel a lock and restore seats
// Handler: cancelLock function
router.post("/:lockId/cancel", cancelLock);

// Export router so app.js can use it
module.exports = router;
