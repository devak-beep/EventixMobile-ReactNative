// ============================================
// SEAT MANAGER - Safe seat operations for single & multi-day events
// ============================================

const Event = require("../models/Event.model");

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Convert a Date or ISO string to a YYYY-MM-DD key (UTC).
 */
function toDateKey(date) {
  return new Date(date).toISOString().split("T")[0];
}

/**
 * Generate a dailySeats Map for a multi-day event.
 * Each day from startDate to endDate gets { total: seatsPerDay, available: seatsPerDay }.
 */
function generateDailySeatsMap(startDate, endDate, seatsPerDay) {
  const map = new Map();
  const start = new Date(startDate);
  const end   = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().split("T")[0];
    map.set(key, { total: seatsPerDay, available: seatsPerDay });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return map;
}

// ─── Single-day event helpers (existing) ────────────────────────────────────

async function restoreSeats(eventId, seats, session = null) {
  const options = session ? { session, new: true } : { new: true };
  const event   = await Event.findById(eventId).session(session);

  if (!event) {
    console.warn(`[SEAT MANAGER] Event ${eventId} not found`);
    return { success: false, seatsRestored: 0, event: null };
  }

  const maxRestorable  = event.totalSeats - event.availableSeats;
  const seatsToRestore = Math.min(seats, maxRestorable);

  if (seatsToRestore <= 0) {
    console.warn(`[SEAT MANAGER] Cannot restore – already at max`);
    return { success: false, seatsRestored: 0, event };
  }

  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id:   eventId,
      $expr: { $lte: [{ $add: ["$availableSeats", seatsToRestore] }, "$totalSeats"] },
    },
    { $inc: { availableSeats: seatsToRestore } },
    options,
  );

  if (!updatedEvent) {
    console.error(`[SEAT MANAGER] Failed to restore ${seatsToRestore} seats`);
    return { success: false, seatsRestored: 0, event };
  }

  console.log(`[SEAT MANAGER] Restored ${seatsToRestore} regular seats to event ${eventId}`);
  return { success: true, seatsRestored: seatsToRestore, event: updatedEvent };
}

async function deductSeats(eventId, seats, session = null) {
  const options      = session ? { session, new: true } : { new: true };
  const updatedEvent = await Event.findOneAndUpdate(
    { _id: eventId, availableSeats: { $gte: seats } },
    { $inc: { availableSeats: -seats } },
    options,
  );

  if (!updatedEvent) {
    console.warn(`[SEAT MANAGER] Cannot deduct ${seats} – not enough available`);
    return { success: false, seatsDeducted: 0, event: null };
  }

  console.log(`[SEAT MANAGER] Deducted ${seats} regular seats from event ${eventId}`);
  return { success: true, seatsDeducted: seats, event: updatedEvent };
}

// ─── Multi-day: Daily pass helpers ──────────────────────────────────────────

/**
 * Atomically deduct `seats` from a specific day in dailySeats.
 * Uses a single findOneAndUpdate with $gte constraint — safe without transaction.
 */
async function deductDailySeats(eventId, dateKey, seats, session = null) {
  const field   = `dailySeats.${dateKey}.available`;
  const options = session ? { session, new: true } : { new: true };

  const updated = await Event.findOneAndUpdate(
    { _id: eventId, [field]: { $gte: seats } },
    { $inc: { [field]: -seats } },
    options,
  );

  if (!updated) {
    console.warn(`[SEAT MANAGER] Not enough daily seats on ${dateKey} for event ${eventId}`);
    return { success: false, event: null };
  }

  console.log(`[SEAT MANAGER] Deducted ${seats} daily seats on ${dateKey} from event ${eventId}`);
  return { success: true, event: updated };
}

/**
 * Restore `seats` to a specific day in dailySeats.
 */
async function restoreDailySeats(eventId, dateKey, seats, session = null) {
  const event = await Event.findById(eventId).session(session);
  if (!event) return { success: false, event: null };

  const daySeats = event.dailySeats && event.dailySeats.get(dateKey);
  if (!daySeats) {
    console.warn(`[SEAT MANAGER] No dailySeats entry for ${dateKey}`);
    return { success: false, event };
  }

  const maxRestorable  = daySeats.total - daySeats.available;
  const seatsToRestore = Math.min(seats, maxRestorable);
  if (seatsToRestore <= 0) {
    console.warn(`[SEAT MANAGER] Daily seats already at max for ${dateKey}`);
    return { success: true, seatsRestored: 0, event };
  }

  const field   = `dailySeats.${dateKey}.available`;
  const options = session ? { session, new: true } : { new: true };
  const updated = await Event.findByIdAndUpdate(
    eventId,
    { $inc: { [field]: seatsToRestore } },
    options,
  );

  console.log(`[SEAT MANAGER] Restored ${seatsToRestore} daily seats on ${dateKey} for event ${eventId}`);
  return { success: true, seatsRestored: seatsToRestore, event: updated };
}

// ─── Multi-day: Season pass helpers ─────────────────────────────────────────

/**
 * Deduct `seats` from ALL days for a season pass.
 * MUST be called inside a MongoDB transaction — not atomic by itself.
 *
 * Returns { success, event } or throws if not enough seats on any day.
 */
async function deductSeasonSeats(eventId, seats, session = null) {
  // Fetch event to read dailySeats
  const event = await Event.findById(eventId).session(session);
  if (!event || event.eventType !== "multi-day") {
    return { success: false, event: null, reason: "Event not found or not multi-day" };
  }

  if (!event.dailySeats || event.dailySeats.size === 0) {
    return { success: false, event: null, reason: "No dailySeats configured on this event" };
  }

  // Check ALL days have enough seats
  for (const [dateKey, daySeats] of event.dailySeats) {
    if (daySeats.available < seats) {
      return {
        success: false,
        event,
        reason: `Day ${dateKey} only has ${daySeats.available} seat(s) available (need ${seats})`,
      };
    }
  }

  // Build $inc update for all days
  const incUpdate = {};
  for (const [dateKey] of event.dailySeats) {
    incUpdate[`dailySeats.${dateKey}.available`] = -seats;
  }

  const options = session ? { session, new: true } : { new: true };
  const updated = await Event.findByIdAndUpdate(eventId, { $inc: incUpdate }, options);

  console.log(`[SEAT MANAGER] Season pass: deducted ${seats} seats from all ${event.dailySeats.size} days for event ${eventId}`);
  return { success: true, event: updated };
}

/**
 * Restore `seats` to ALL days for a season pass cancellation / failure.
 * MUST be called inside a MongoDB transaction.
 */
async function restoreSeasonSeats(eventId, seats, session = null) {
  const event = await Event.findById(eventId).session(session);
  if (!event || !event.dailySeats || event.dailySeats.size === 0) {
    console.warn(`[SEAT MANAGER] Cannot restore season seats – event ${eventId} not found or has no dailySeats`);
    return { success: false, event: null };
  }

  // Build $inc restore for all days (cap at total)
  const incUpdate = {};
  for (const [dateKey, daySeats] of event.dailySeats) {
    const restorable = Math.min(seats, daySeats.total - daySeats.available);
    if (restorable > 0) {
      incUpdate[`dailySeats.${dateKey}.available`] = restorable;
    }
  }

  if (Object.keys(incUpdate).length === 0) {
    console.warn(`[SEAT MANAGER] Season restore: all days already at capacity`);
    return { success: true, seatsRestored: 0, event };
  }

  const options = session ? { session, new: true } : { new: true };
  const updated = await Event.findByIdAndUpdate(eventId, { $inc: incUpdate }, options);

  console.log(`[SEAT MANAGER] Season pass: restored ${seats} seats across all days for event ${eventId}`);
  return { success: true, seatsRestored: seats, event: updated };
}

// ─── Season pass availability check ────────────────────────────────────────

/**
 * Return true only if ALL days have at least `seats` available.
 * Used by the frontend (via event detail endpoint) and locking logic.
 */
async function isSeasonPassAvailable(eventId, seats = 1, session = null) {
  const event = await Event.findById(eventId).session(session);
  if (!event || !event.dailySeats) return false;

  for (const [, daySeats] of event.dailySeats) {
    if (daySeats.available < seats) return false;
  }
  return true;
}

// ─── Fix corrupted seat counts ──────────────────────────────────────────────

async function fixEventSeats(eventId, session = null) {
  const SeatLock = require("../models/SeatLock.model");

  const event = await Event.findById(eventId).session(session);
  if (!event) return { corrected: false, error: "Event not found" };

  const lockAggregate = await SeatLock.aggregate([
    { $match: { eventId: event._id, status: { $in: ["ACTIVE", "CONSUMED"] } } },
    { $group: { _id: null, total: { $sum: "$seats" } } },
  ]).session(session);

  const totalLockedSeats        = lockAggregate.length > 0 ? lockAggregate[0].total : 0;
  const correctAvailableSeats   = event.totalSeats - totalLockedSeats;

  if (event.availableSeats === correctAvailableSeats) {
    return { corrected: false, oldValue: event.availableSeats, newValue: correctAvailableSeats, message: "Already correct" };
  }

  const oldValue        = event.availableSeats;
  event.availableSeats  = correctAvailableSeats;
  await event.save({ session });

  console.log(`[SEAT MANAGER] Fixed event ${eventId}: ${oldValue} → ${correctAvailableSeats}`);
  return { corrected: true, oldValue, newValue: correctAvailableSeats };
}

module.exports = {
  // Single-day
  restoreSeats,
  deductSeats,
  // Multi-day daily pass
  deductDailySeats,
  restoreDailySeats,
  // Multi-day season pass
  deductSeasonSeats,
  restoreSeasonSeats,
  // Helpers
  isSeasonPassAvailable,
  generateDailySeatsMap,
  toDateKey,
  fixEventSeats,
};
