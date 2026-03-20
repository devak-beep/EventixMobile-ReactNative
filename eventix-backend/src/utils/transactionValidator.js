// Transaction validation utility
// Ensures all critical operations maintain ACID properties

const mongoose = require("mongoose");

/**
 * Validates that a function properly uses MongoDB transactions
 * @param {Function} operation - The operation to validate
 * @param {string} operationName - Name for logging
 * @returns {Function} - Wrapped operation with transaction validation
 */
function validateTransaction(operation, operationName) {
  return async function(...args) {
    const session = mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Execute the operation with session
      const result = await operation.call(this, ...args, { session });
      
      await session.commitTransaction();
      session.endSession();
      
      console.log(`[TRANSACTION] ${operationName} completed successfully`);
      return result;
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      console.error(`[TRANSACTION ERROR] ${operationName}:`, error.message);
      throw error;
    }
  };
}

/**
 * Ensures atomic seat operations
 * @param {string} eventId 
 * @param {number} seatChange - Positive for release, negative for lock
 * @param {Object} session - MongoDB session
 */
async function atomicSeatUpdate(eventId, seatChange, session) {
  const event = await Event.findById(eventId).session(session);
  
  if (!event) {
    throw new Error("Event not found");
  }
  
  const newAvailableSeats = event.availableSeats + seatChange;
  
  if (newAvailableSeats < 0) {
    throw new Error("Insufficient seats available");
  }
  
  if (newAvailableSeats > event.totalSeats) {
    throw new Error("Cannot exceed total seats");
  }
  
  event.availableSeats = newAvailableSeats;
  await event.save({ session });
  
  return event;
}

module.exports = {
  validateTransaction,
  atomicSeatUpdate
};
