// ============================================
// PAYMENT ROUTES - API endpoints for payment processing
// ============================================

// Import Express router
const express = require("express");
// Create router instance
const router = express.Router();

// Import payment controller
const { createPaymentIntent, processPayment } = require("../controllers/payment.controller");

// ROUTE 1: POST /api/payments/intent
// Purpose: Create a payment intent (simulate payment)
// Handler: createPaymentIntent function
// Request body: {bookingId, force: "success" | "failure" | "timeout"}
// Response: {success: true, paymentStatus}
router.post("/intent", createPaymentIntent);

// ROUTE 2: POST /api/payments/:bookingId/process
// Purpose: Process payment for a booking
// Handler: processPayment function
// Request body: {status: "SUCCESS" | "FAILURE" | "TIMEOUT", idempotencyKey}
// Response: {success: true, message}
router.post("/:bookingId/process", processPayment);

// Export router so app.js can use it
module.exports = router;
