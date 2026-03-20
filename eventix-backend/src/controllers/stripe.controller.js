const Booking = require("../models/Booking.model");
const stripe = process.env.STRIPE_SECRET_KEY 
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

// Create Stripe checkout session
exports.createCheckoutSession = async (req, res) => {
  const { bookingId } = req.params;

  if (!stripe) {
    return res.status(503).json({ 
      success: false, 
      message: "Payment gateway not configured" 
    });
  }

  try {
    const booking = await Booking.findById(bookingId).populate('event');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== 'PAYMENT_PENDING') {
      return res.status(400).json({ success: false, message: "Booking not ready for payment" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: booking.event.name,
            description: `${booking.seats} seat(s)`,
          },
          unit_amount: booking.amount * 100, // Convert to paise
        },
        quantity: booking.seats,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?booking_id=${bookingId}`,
      metadata: {
        bookingId: bookingId.toString(),
      },
    });

    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify payment and update booking
exports.verifyPayment = async (req, res) => {
  const { sessionId, bookingId } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const booking = await Booking.findById(bookingId);
      
      if (booking && booking.status === 'PAYMENT_PENDING') {
        booking.status = 'CONFIRMED';
        booking.stripeSessionId = sessionId;
        await booking.save();

        return res.json({ 
          success: true, 
          message: "Payment verified and booking confirmed",
          booking 
        });
      }
    }

    res.status(400).json({ success: false, message: "Payment verification failed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Webhook handler for Stripe events
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata.bookingId;

    const booking = await Booking.findById(bookingId);
    if (booking && booking.status === 'PAYMENT_PENDING') {
      booking.status = 'CONFIRMED';
      booking.stripeSessionId = session.id;
      await booking.save();
    }
  }

  res.json({ received: true });
};
