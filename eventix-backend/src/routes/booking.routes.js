// ============================================
// BOOKING ROUTES - API endpoints for booking confirmation
// ============================================

// Import Express router
const express = require("express");
// Create router instance
const router = express.Router();

// Import controller functions
const {
  confirmBooking, // Converts a lock into a booking
  getAllBookings,
  getBookingById,
} = require("../controllers/bookingConfirmation.controller");

// ROUTE 0: GET /api/bookings
// Purpose: View all bookings
// Response: [booking1, booking2, ...]
router.get("/", getAllBookings);

// ROUTE 0B: GET /api/bookings/:id
// Purpose: View specific booking
// URL parameter: id (bookingId)
// Response: {booking}
router.get("/:id", getBookingById);

// ROUTE 1: POST /api/bookings/confirm
// Purpose: Confirm a booking (convert lock to booking)
// Handler: confirmBooking function
// Request body: {lockId}
// Response: {success: true, booking}
// What happens:
// 1. Validates lock hasn't expired
// 2. Creates booking with PAYMENT_PENDING status
// 3. Deletes the lock (no longer needed)
router.post("/confirm", confirmBooking);

// ROUTE 2: POST /api/bookings/:id/confirm
// Purpose: Alternative route - confirm booking using URL parameter
// Handler: Same confirmBooking function
// URL parameter: id (lockId)
// Response: {success: true, booking}
router.post("/:id/confirm", confirmBooking);

// Export router so app.js can use it
module.exports = router;
