const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/razorpay.controller');

// Booking payment routes
router.post('/create-order', razorpayController.createOrder);
router.post('/verify-payment', razorpayController.verifyPayment);
router.post('/payment-failed', razorpayController.paymentFailed);

// Event creation payment routes
router.post('/create-event-order', razorpayController.createEventOrder);
router.post('/verify-event-payment', razorpayController.verifyEventPayment);

module.exports = router;
