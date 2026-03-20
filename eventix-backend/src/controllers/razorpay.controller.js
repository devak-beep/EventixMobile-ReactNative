// ============================================
// RAZORPAY CONTROLLER
// ============================================

const Razorpay   = require("razorpay");
const crypto     = require("crypto");
const mongoose   = require("mongoose");
const Booking    = require("../models/Booking.model");
const SeatLock   = require("../models/SeatLock.model");
const Event      = require("../models/Event.model");
const {
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  generateDailySeatsMap,
  toDateKey,
} = require("../utils/seatManager");

// ─── Razorpay client (lazy-initialized) ─────────────────────────────────────
let razorpay = null;
function getRazorpay() {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

// ─── Helper: compute booking amount based on passType ────────────────────────
function computeBookingAmount(booking, event) {
  const seatCount = booking.seats.length;

  switch (booking.passType) {
    case "daily":
      // Daily pass: price × number of seats selected for that day
      return (event.passOptions?.dailyPass?.price ?? 0) * seatCount;

    case "season":
      // Season pass: flat price × number of season passes (one per person)
      return (event.passOptions?.seasonPass?.price ?? 0) * seatCount;

    case "regular":
    default:
      // Single-day event: event amount × seat count
      return (event.amount ?? 0) * seatCount;
  }
}

// ─── POST /api/razorpay/create-order ────────────────────────────────────────
exports.createOrder = async (req, res) => {
  const rz = getRazorpay();
  if (!rz) {
    return res.status(503).json({ success: false, message: "Payment gateway not configured" });
  }

  const { bookingId } = req.body;

  try {
    const booking = await Booking.findById(bookingId).populate("event");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "PAYMENT_PENDING") {
      return res.status(400).json({ success: false, message: "Booking not ready for payment" });
    }

    const amountInRupees = computeBookingAmount(booking, booking.event);
    const amountInPaise  = amountInRupees * 100;

    const options = {
      amount:   amountInPaise,
      currency: "INR",
      receipt:  `booking_${bookingId}`,
      notes: {
        bookingId:  bookingId.toString(),
        eventName:  booking.event.name,
        seats:      booking.seats.length,
        passType:   booking.passType,
      },
    };

    const order = await rz.orders.create(options);

    // Store order ID + amount on the booking
    booking.razorpayOrderId = order.id;
    booking.amount = amountInRupees;
    await booking.save();

    return res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[RAZORPAY] createOrder error:", error);
    return res.status(500).json({ success: false, message: "Failed to create payment order", error: error.message });
  }
};

// ─── POST /api/razorpay/verify-payment ──────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

  try {
    // ── Signature check ───────────────────────────────────────────────────
    const sign         = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const booking = await Booking.findById(bookingId).session(session);

      if (!booking) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Booking not found" });
      }

      // ── Idempotency: already confirmed ───────────────────────────────────
      if (booking.status === "CONFIRMED") {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          message: "Payment already confirmed (idempotent)",
          booking: { id: booking._id, status: booking.status, amount: booking.amount },
          isRetry: true,
        });
      }

      // Update booking
      booking.status            = "CONFIRMED";
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save({ session });

      // Mark seat lock CONSUMED
      if (booking.seatLockId) {
        await SeatLock.findByIdAndUpdate(booking.seatLockId, { status: "CONSUMED" }, { session });
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Payment verified and booking confirmed",
        booking: { id: booking._id, status: booking.status, amount: booking.amount },
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[RAZORPAY] verifyPayment error:", error);
    return res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

// ─── POST /api/razorpay/payment-failed ──────────────────────────────────────
exports.paymentFailed = async (req, res) => {
  const { bookingId } = req.body;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // ── Idempotency ────────────────────────────────────────────────────────
    if (booking.status !== "PAYMENT_PENDING") {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({ success: true, message: "Payment already processed (idempotent)", alreadyProcessed: true });
    }

    booking.status = "FAILED";
    await booking.save({ session });

    // ── Restore seats (pass-type aware) ───────────────────────────────────
    if (booking.seatLockId) {
      const lock = await SeatLock.findById(booking.seatLockId).session(session);

      if (lock && lock.status === "ACTIVE") {
        if (lock.passType === "regular") {
          await restoreSeats(lock.eventId, lock.seats, session);
        } else if (lock.passType === "daily") {
          const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
          if (dateKey) await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
        } else if (lock.passType === "season") {
          await restoreSeasonSeats(lock.eventId, lock.seats, session);
        }

        lock.status = "EXPIRED";
        await lock.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: "Payment failure recorded, seats restored" });
  } catch (err) {
    console.error("[RAZORPAY] paymentFailed error:", err);
    return res.status(500).json({ success: false, message: "Failed to handle payment failure", error: err.message });
  }
};

// ─── POST /api/razorpay/create-event-order ───────────────────────────────────
exports.createEventOrder = async (req, res) => {
  const rz = getRazorpay();
  if (!rz) {
    return res.status(503).json({ success: false, message: "Payment gateway not configured" });
  }

  const { amount, eventData } = req.body;

  try {
    const amountInPaise = amount * 100;

    const options = {
      amount:   amountInPaise,
      currency: "INR",
      receipt:  `event_creation_${Date.now()}`,
      notes: {
        eventName:  eventData.name,
        purpose:    "event_creation",
        totalSeats: eventData.totalSeats,
      },
    };

    const order = await rz.orders.create(options);

    return res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("[RAZORPAY] createEventOrder error:", error);
    return res.status(500).json({ success: false, message: "Failed to create event payment order", error: error.message });
  }
};

// ─── POST /api/razorpay/verify-event-payment ────────────────────────────────
exports.verifyEventPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventData } = req.body;

  try {
    // ── Idempotency ────────────────────────────────────────────────────────
    if (eventData.idempotencyKey) {
      const existingEvent = await Event.findOne({ idempotencyKey: eventData.idempotencyKey });
      if (existingEvent) {
        return res.status(200).json({
          success: true,
          message: "Event already created with this payment (idempotent)",
          event: { id: existingEvent._id, name: existingEvent.name, paymentStatus: existingEvent.paymentStatus },
          isRetry: true,
        });
      }
    }

    // ── Signature check ────────────────────────────────────────────────────
    const sign         = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // ── Validate required fields ───────────────────────────────────────────
    const {
      name, description, eventType, eventDate, endDate,
      totalSeats, type, category, amount, currency,
      passOptions, idempotencyKey, image, userId,
    } = eventData;

    if (!name || !eventDate || !totalSeats || !category || amount === undefined) {
      return res.status(400).json({ success: false, message: "Missing required event fields" });
    }

    if (new Date(eventDate) <= new Date()) {
      return res.status(400).json({ success: false, message: "Event date must be in the future" });
    }

    // ── Compute creation charge ────────────────────────────────────────────
    let creationCharge = 500;
    if      (totalSeats <= 50)    creationCharge = 500;
    else if (totalSeats <= 100)   creationCharge = 1000;
    else if (totalSeats <= 200)   creationCharge = 1500;
    else if (totalSeats <= 500)   creationCharge = 2500;
    else if (totalSeats <= 1000)  creationCharge = 5000;
    else if (totalSeats <= 2000)  creationCharge = 8000;
    else if (totalSeats <= 5000)  creationCharge = 12000;
    else if (totalSeats <= 10000) creationCharge = 20000;
    else if (totalSeats <= 20000) creationCharge = 35000;
    else if (totalSeats <= 50000) creationCharge = 60000;
    else                          creationCharge = 100000;

    // ── Transactional event creation ───────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const resolvedEventType = eventType || "single-day";

      const eventPayload = {
        name,
        description:    description ? description.trim() : "",
        eventType:      resolvedEventType,
        eventDate,
        totalSeats,
        availableSeats: totalSeats,
        type:           type || "public",
        category,
        amount:         resolvedEventType === "single-day" ? (amount || 0) : 0,
        currency:       currency || "INR",
        creationCharge,
        createdBy:      userId,
        idempotencyKey: idempotencyKey || null,
        image:          image || null,
        paymentStatus:  "PAID",
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        creationFee:    creationCharge,
        isPublished:    true,
      };

      // ── Multi-day: add endDate, passOptions, AND populate dailySeats ──────
      if (resolvedEventType === "multi-day") {
        if (!endDate) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: "endDate is required for multi-day events" });
        }

        eventPayload.endDate     = endDate;
        eventPayload.passOptions = passOptions || {};
        eventPayload.dailySeats  = generateDailySeatsMap(eventDate, endDate, totalSeats);
      }

      const [event] = await Event.create([eventPayload], { session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Payment verified and event created",
        event: { id: event._id, name: event.name, paymentStatus: event.paymentStatus },
      });
    } catch (sessionError) {
      await session.abortTransaction();
      session.endSession();
      throw sessionError;
    }
  } catch (error) {
    console.error("[RAZORPAY] verifyEventPayment error:", error);
    return res.status(500).json({ success: false, message: "Payment verification failed – event not created", error: error.message });
  }
};
