// ============================================
// LOCK CONTROLLER - Seat locking for single & multi-day events
// ============================================

const mongoose    = require("mongoose");
const SeatLock    = require("../models/SeatLock.model");
const Event       = require("../models/Event.model");
const Booking     = require("../models/Booking.model");
const {
  deductSeats,
  deductDailySeats,
  deductSeasonSeats,
  restoreSeats,
  restoreDailySeats,
  restoreSeasonSeats,
  isSeasonPassAvailable,
  toDateKey,
} = require("../utils/seatManager");

// ─── POST /api/locks ─────────────────────────────────────────────────────────
/**
 * Lock seats before payment.
 *
 * Body for single-day event:
 *   { userId, eventId, seats, passType: "regular", idempotencyKey }
 *
 * Body for multi-day – daily pass:
 *   { userId, eventId, seats, passType: "daily", selectedDate: "YYYY-MM-DD", idempotencyKey }
 *
 * Body for multi-day – season pass:
 *   { userId, eventId, seats, passType: "season", idempotencyKey }
 */
async function lockSeats(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { userId, seats, passType = "regular", selectedDate, idempotencyKey } = req.body;
    // eventId can come from URL params (POST /events/:eventId/lock) OR request body
    const eventId = req.params.eventId || req.body.eventId;

    // ── Validate required fields ──────────────────────────────────────────
    if (!userId || !eventId || !seats) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "userId, eventId and seats are required" });
    }

    // ── Idempotency check ─────────────────────────────────────────────────
    if (idempotencyKey) {
      const existing = await SeatLock.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({ success: true, lock: existing, isRetry: true });
      }
    }

    // ── Load event ────────────────────────────────────────────────────────
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (!event.isPublished) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Event is not available for booking" });
    }

    // ── Check event has not expired ───────────────────────────────────────
    const now = new Date();
    const expiryDate = event.eventType === "multi-day" && event.endDate
      ? new Date(new Date(event.endDate).setHours(23, 59, 59, 999))
      : new Date(event.eventDate);
    if (expiryDate <= now) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "This event has already ended. Booking is no longer available." });
    }

    // ── Determine effective passType ──────────────────────────────────────
    const isMultiDay = event.eventType === "multi-day";
    const effectivePassType = isMultiDay ? passType : "regular";

    // ── Seat deduction by pass type ───────────────────────────────────────
    let seatDeductResult;

    if (effectivePassType === "regular") {
      // ── Single-day event ────────────────────────────────────────────────
      seatDeductResult = await deductSeats(eventId, seats, session);
      if (!seatDeductResult.success) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ success: false, message: "Not enough seats available" });
      }

    } else if (effectivePassType === "daily") {
      // ── Multi-day daily pass ────────────────────────────────────────────
      if (!selectedDate) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "selectedDate is required for daily pass" });
      }
      if (!event.passOptions?.dailyPass?.enabled) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "Daily pass is not available for this event" });
      }

      const dateKey = toDateKey(selectedDate);
      // Validate the date is within the event's date range
      const eventStart = toDateKey(event.eventDate);
      const eventEnd   = toDateKey(event.endDate);
      if (dateKey < eventStart || dateKey > eventEnd) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Selected date ${dateKey} is outside event dates (${eventStart} – ${eventEnd})` });
      }

      seatDeductResult = await deductDailySeats(eventId, dateKey, seats, session);
      if (!seatDeductResult.success) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ success: false, message: `Not enough daily seats available for ${dateKey}` });
      }

    } else if (effectivePassType === "season") {
      // ── Multi-day season pass ───────────────────────────────────────────
      if (!event.passOptions?.seasonPass?.enabled) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "Season pass is not available for this event" });
      }

      seatDeductResult = await deductSeasonSeats(eventId, seats, session);
      if (!seatDeductResult.success) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: seatDeductResult.reason || "Not enough seats for season pass (some days are sold out)",
        });
      }

    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Unknown passType: ${effectivePassType}` });
    }

    // ── Build lock data ───────────────────────────────────────────────────
    const lockData = {
      userId,
      eventId,
      seats,
      passType: effectivePassType,
      status:   "ACTIVE",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
      ...(idempotencyKey && { idempotencyKey }),
    };

    // Store selectedDate for daily pass (as midnight UTC of that day)
    if (effectivePassType === "daily" && selectedDate) {
      lockData.selectedDate = new Date(`${toDateKey(selectedDate)}T00:00:00.000Z`);
    }

    const [lock] = await SeatLock.create([lockData], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ success: true, lock });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[LOCK CONTROLLER] lockSeats error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
}

// ─── GET /api/locks ──────────────────────────────────────────────────────────
async function getAllLocks(req, res) {
  try {
    const locks = await SeatLock.find().populate("eventId", "name eventDate").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, locks });
  } catch (err) {
    console.error("[LOCK CONTROLLER] getAllLocks error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
}

// ─── POST /api/locks/:id/cancel ──────────────────────────────────────────────
async function cancelLock(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    const lock = await SeatLock.findById(id).session(session);
    if (!lock) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Lock not found" });
    }

    if (lock.status !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Lock is already ${lock.status}` });
    }

    // ── Restore seats based on passType ───────────────────────────────────
    if (lock.passType === "regular") {
      await restoreSeats(lock.eventId, lock.seats, session);
    } else if (lock.passType === "daily") {
      const dateKey = lock.selectedDate ? toDateKey(lock.selectedDate) : null;
      if (dateKey) {
        await restoreDailySeats(lock.eventId, dateKey, lock.seats, session);
      } else {
        console.warn(`[LOCK CONTROLLER] cancelLock: daily lock ${id} has no selectedDate`);
      }
    } else if (lock.passType === "season") {
      await restoreSeasonSeats(lock.eventId, lock.seats, session);
    }

    lock.status = "CANCELLED";
    await lock.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: "Lock cancelled and seats restored", lock });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[LOCK CONTROLLER] cancelLock error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
}

module.exports = { lockSeats, getAllLocks, cancelLock };
