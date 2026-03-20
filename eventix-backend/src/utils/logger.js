const winston = require("winston");
const Audit = require("../models/Audit.model");

// For serverless, only use console logging (no file system)
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Audit logger for booking state changes (console only in serverless)
const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

async function logBookingStateChange(
  bookingId,
  fromState,
  toState,
  userId,
  correlationId,
  eventId = null,
  action = "BOOKING_CREATED",
  metadata = {},
) {
  // 1. Log to file (existing functionality)
  auditLogger.info({
    type: "BOOKING_STATE_CHANGE",
    bookingId,
    fromState,
    toState,
    userId,
    correlationId,
    timestamp: new Date().toISOString(),
  });

  // 2. Store in MongoDB
  try {
    await Audit.create({
      bookingId,
      eventId: eventId || metadata.eventId,
      fromStatus: fromState,
      toStatus: toState,
      action,
      correlationId,
      metadata: {
        ...metadata,
        userId,
      },
    });
  } catch (error) {
    logger.error("Failed to store audit record in MongoDB:", error);
  }
}

function logError(error, context = {}, correlationId = null) {
  logger.error({
    message: error.message,
    stack: error.stack,
    context,
    correlationId,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { logger, logBookingStateChange, logError };
