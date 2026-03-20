const Booking = require("../models/Booking.model");
const {
  canTransition,
  BOOKING_STATUS,
} = require("../utils/bookingStateMachine");
const { logBookingStateChange } = require("../utils/logger");

const PAYMENT_WINDOW_MINUTES = 10;

async function moveToPaymentPending(bookingId, correlationId = null) {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const oldStatus = booking.status;
  if (!canTransition(oldStatus, BOOKING_STATUS.PAYMENT_PENDING)) {
    throw new Error("INVALID_STATE_TRANSITION");
  }

  booking.status = BOOKING_STATUS.PAYMENT_PENDING;
  booking.paymentExpiresAt = new Date(
    Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000,
  );

  await booking.save();
  
  logBookingStateChange(
    bookingId,
    oldStatus,
    BOOKING_STATUS.PAYMENT_PENDING,
    booking.user,
    correlationId
  );

  return booking;
}

module.exports = {
  moveToPaymentPending,
};
