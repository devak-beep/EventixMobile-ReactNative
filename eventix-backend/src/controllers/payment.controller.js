const Booking = require("../models/Booking.model");
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");
const PaymentAttempt = require("../models/PaymentAttempt.model");
const {
  BOOKING_STATUS,
  canTransition,
} = require("../utils/bookingStateMachine");
const mongoose = require("mongoose");

// Process payment for a booking
exports.processPayment = async (req, res) => {
  const { bookingId } = req.params;
  const { status, idempotencyKey } = req.body;

  if (!status || !idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: "status and idempotencyKey are required",
    });
  }

  if (!["SUCCESS", "FAILURE", "TIMEOUT"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "status must be SUCCESS, FAILURE, or TIMEOUT",
    });
  }

  try {
    // Check for idempotency
    const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
    if (existingAttempt) {
      return res.status(200).json({
        success: true,
        message: "Payment already processed (idempotent)",
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Record payment attempt
    const seatCount = Array.isArray(booking.seats)
      ? booking.seats.length
      : booking.seats || 1;
    await PaymentAttempt.create({
      bookingId,
      idempotencyKey,
      forceResult: status.toLowerCase(), // Convert SUCCESS to success
      status:
        status === "SUCCESS"
          ? "SUCCESS"
          : status === "FAILURE"
            ? "FAILED"
            : "TIMEOUT",
      amount: seatCount * 100, // Calculate from seats count
    });

    // Update booking based on payment status
    if (status === "SUCCESS") {
      booking.status = "CONFIRMED";
      booking.amount = seatCount * 100; // Save the amount to booking
      await booking.save();

      // Mark the seat lock as CONSUMED to prevent seat restoration
      if (booking.seatLockId) {
        await SeatLock.findByIdAndUpdate(booking.seatLockId, {
          status: "CONSUMED",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment successful, booking confirmed",
      });
    } else if (status === "FAILURE") {
      // Only restore seats if booking was PAYMENT_PENDING
      if (booking.status === "PAYMENT_PENDING") {
        booking.status = "FAILED";
        await booking.save();

        // BUGFIX: Restore seats via lock (like paymentFailed does)
        // This ensures lock status is updated to prevent double restoration
        if (booking.seatLockId) {
          const lock = await SeatLock.findById(booking.seatLockId);
          if (lock && lock.status === "ACTIVE") {
            // Use constraint check to prevent overselling
            const event = await Event.findById(booking.event);
            if (event) {
              const newAvailableSeats = Math.min(
                event.availableSeats + lock.seats,
                event.totalSeats,
              );
              event.availableSeats = newAvailableSeats;
              await event.save();
            }
            lock.status = "EXPIRED";
            await lock.save();
            console.log(
              `[PAYMENT] Restored ${lock.seats} seats for lock ${lock._id}`,
            );
          } else if (lock) {
            console.log(
              `[PAYMENT] Lock ${lock._id} already ${lock.status}, skipping seat restoration`,
            );
          }
        }

        return res.status(200).json({
          success: true,
          message: "Payment failed, seats restored",
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Booking is not in PAYMENT_PENDING status",
        });
      }
    } else if (status === "TIMEOUT") {
      // TIMEOUT - keep as PAYMENT_PENDING, let expiry job handle it
      return res.status(200).json({
        success: true,
        message: "Payment timeout recorded, booking will expire automatically",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message,
    });
  }
};

// ========== TASK 5.1: Payment Intent API with Idempotency ==========
exports.createPaymentIntent = async (req, res) => {
  const { bookingId, amount, force, idempotencyKey } = req.body;
  const correlationId =
    req.headers["x-correlation-id"] || `payment-${Date.now()}`;

  // 1️⃣ Basic validation
  if (!bookingId || !amount || !force || !idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: "bookingId, amount, force, and idempotencyKey are required",
    });
  }

  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than 0",
    });
  }

  if (!["success", "failure", "timeout"].includes(force)) {
    return res.status(400).json({
      success: false,
      message: "force must be success | failure | timeout",
    });
  }

  // 2️⃣ IDEMPOTENCY CHECK - Return existing payment attempt if found
  const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
  if (existingAttempt) {
    console.log(
      `[PAYMENT IDEMPOTENCY] Returning cached response for key: ${idempotencyKey}`,
    );

    // Add retry flag to audit logs
    await require("../utils/logger").logBookingStateChange(
      bookingId,
      "PAYMENT_RETRY",
      "PAYMENT_RETRY",
      null,
      correlationId,
      null,
      "PAYMENT_RETRY",
      { isRetry: true, originalAttemptId: existingAttempt._id },
    );

    return res.status(200).json({
      ...existingAttempt.response,
      isRetry: true,
      originalAttemptId: existingAttempt._id,
    });
  }

  // 3️⃣ Fetch booking
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  // 4️⃣ Only PAYMENT_PENDING bookings can accept payment
  if (booking.status !== BOOKING_STATUS.PAYMENT_PENDING) {
    return res.status(400).json({
      success: false,
      message: `Payment not allowed in ${booking.status} state`,
    });
  }

  // 5️⃣ Create payment attempt record for idempotency
  const paymentAttempt = await PaymentAttempt.create({
    idempotencyKey,
    bookingId,
    amount,
    forceResult: force,
    correlationId,
    status: "PROCESSING",
  });

  // 6️⃣ Store amount in booking
  booking.amount = amount;
  await booking.save();

  let response;

  // 7️⃣ Process payment based on force result
  if (force === "timeout") {
    response = {
      success: true,
      paymentStatus: "TIMEOUT",
      message: "Payment timed out (simulated)",
      amount: amount,
      correlationId,
    };
    paymentAttempt.status = "TIMEOUT";
  } else if (force === "failure") {
    response = await handlePaymentFailure(
      bookingId,
      amount,
      res,
      correlationId,
      true,
    );
    paymentAttempt.status = "FAILED";
  } else {
    response = await handlePaymentSuccess(
      bookingId,
      amount,
      res,
      correlationId,
      true,
    );
    paymentAttempt.status = "SUCCESS";
  }

  // 8️⃣ Store response for future idempotency checks
  paymentAttempt.response = response;
  await paymentAttempt.save();

  return res.status(200).json(response);
};

// ========== TASK 5.2: Payment Success Flow ==========
async function handlePaymentSuccess(
  bookingId,
  amount,
  res,
  correlationId,
  returnData = false,
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Fetch booking with lock
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      const errorResponse = {
        success: false,
        message: "Booking not found",
      };
      return returnData ? errorResponse : res.status(404).json(errorResponse);
    }

    // 2️⃣ Verify state transition is valid
    if (!canTransition(booking.status, BOOKING_STATUS.CONFIRMED)) {
      await session.abortTransaction();
      session.endSession();
      const errorResponse = {
        success: false,
        message: "Invalid state transition to CONFIRMED",
      };
      return returnData ? errorResponse : res.status(400).json(errorResponse);
    }

    // 3️⃣ Update booking to CONFIRMED with amount
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.amount = amount; // Store successful payment amount
    await booking.save({ session });

    // 4️⃣ Consume seat lock (mark as CONSUMED)
    if (booking.seatLockId) {
      const lock = await SeatLock.findById(booking.seatLockId).session(session);

      if (lock) {
        lock.status = "CONSUMED";
        await lock.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const successResponse = {
      success: true,
      paymentStatus: "SUCCESS",
      message: "Payment successful and booking confirmed",
      booking: {
        id: booking._id,
        status: booking.status,
        event: booking.event,
        user: booking.user,
        seats: booking.seats,
      },
      amount: booking.amount,
      correlationId,
    };

    return returnData ? successResponse : res.status(200).json(successResponse);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const errorResponse = {
      success: false,
      message: "Payment success processing failed",
      error: error.message,
    };
    return returnData ? errorResponse : res.status(500).json(errorResponse);
  }
}

// ========== TASK 5.3: Payment Failure Flow with Refund ==========
async function handlePaymentFailure(
  bookingId,
  amount,
  res,
  correlationId,
  returnData = false,
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Fetch booking
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      const errorResponse = {
        success: false,
        message: "Booking not found",
      };
      return returnData ? errorResponse : res.status(404).json(errorResponse);
    }

    // 2️⃣ Verify state transition is valid
    if (!canTransition(booking.status, BOOKING_STATUS.FAILED)) {
      await session.abortTransaction();
      session.endSession();
      const errorResponse = {
        success: false,
        message: "Invalid state transition to FAILED",
      };
      return returnData ? errorResponse : res.status(400).json(errorResponse);
    }

    // 3️⃣ Update booking to FAILED with refund amount
    booking.status = BOOKING_STATUS.FAILED;
    booking.amount = amount; // Store attempted payment amount
    booking.refundAmount = amount; // Full refund for failed payment
    await booking.save({ session });

    // 4️⃣ Release seats: Restore availableSeats in Event
    if (booking.seatLockId) {
      const lock = await SeatLock.findById(booking.seatLockId).session(session);

      if (lock) {
        // Release the locked seats back to the event
        const event = await Event.findById(lock.eventId).session(session);

        if (event) {
          event.availableSeats += lock.seats;
          event.availableSeats = Math.min(
            event.availableSeats,
            event.totalSeats,
          );
          await event.save({ session });
        }

        // Mark lock as EXPIRED (not consumable)
        lock.status = "EXPIRED";
        await lock.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    const failureResponse = {
      success: true,
      paymentStatus: "FAILED",
      message: "Payment failed, seats released, and refund processed",
      booking: {
        id: booking._id,
        status: booking.status,
        event: booking.event,
        user: booking.user,
      },
      amount: booking.amount,
      refundAmount: booking.refundAmount,
      correlationId,
    };

    return returnData ? failureResponse : res.status(200).json(failureResponse);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    const errorResponse = {
      success: false,
      message: "Payment failure processing failed",
      error: error.message,
    };
    return returnData ? errorResponse : res.status(500).json(errorResponse);
  }
}
