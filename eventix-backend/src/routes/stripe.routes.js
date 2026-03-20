const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');

router.post('/create-checkout-session/:bookingId', stripeController.createCheckoutSession);
router.get('/verify-payment', stripeController.verifyPayment);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeController.stripeWebhook);

module.exports = router;
