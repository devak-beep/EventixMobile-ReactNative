const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },
  fromStatus: {
    type: String,
    default: null
  },
  toStatus: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['LOCK_CREATED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED', 'BOOKING_CREATED']
  },
  correlationId: {
    type: String,
    default: null
  },
  metadata: {
    reason: String,
    errorCode: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Audit", auditSchema);
