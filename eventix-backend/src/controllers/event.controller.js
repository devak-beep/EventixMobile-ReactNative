const mongoose = require("mongoose");
const Event = require("../models/Event.model");
const SeatLock = require("../models/SeatLock.model");

/**
 * Helper function to generate daily seats map for multi-day events
 */
function generateDailySeatsMap(startDate, endDate, seatsPerDay) {
  const dailySeats = new Map();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set to start of day for consistent date keys
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    dailySeats.set(dateKey, {
      total: seatsPerDay,
      available: seatsPerDay
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dailySeats;
}

/**
 * Helper function to check if season pass is available
 * Season pass is only available if ALL days have at least 1 seat
 */
function isSeasonPassAvailable(dailySeats) {
  for (const [date, seats] of dailySeats.entries()) {
    if (seats.available < 1) {
      return false;
    }
  }
  return true;
}

/**
 * Create a new event
 * NOTE: This endpoint should NOT be used directly for event creation during payment flow.
 * Use verifyEventPayment in razorpay.controller.js instead to ensure payment is verified first.
 * This endpoint is kept for backward compatibility and admin direct creation only.
 */
exports.createEvent = async (req, res) => {
  const {
    name,
    description,
    eventDate,
    totalSeats,
    type,
    category,
    amount,
    currency,
    idempotencyKey,
    image,
    paymentVerified,
  } = req.body;

  // Safety check: if paymentVerified is not explicitly true, require payment to be made through Razorpay
  // This prevents accidental event creation without payment
  if (!paymentVerified && amount > 0) {
    return res.status(403).json({
      success: false,
      message:
        "Event creation requires payment verification. Please use the payment flow.",
    });
  }

  if (!name || !eventDate || !totalSeats || !category || amount === undefined) {
    return res.status(400).json({
      success: false,
      message: "name, eventDate, totalSeats, category, and amount are required",
    });
  }

  // Idempotency check
  if (idempotencyKey) {
    const existingEvent = await Event.findOne({ idempotencyKey });
    if (existingEvent) {
      return res.status(200).json({
        success: true,
        data: existingEvent,
        creationCharge: existingEvent.creationCharge,
        message: `Event already created (idempotent). Creation charge: ₹${existingEvent.creationCharge}`,
        isRetry: true,
      });
    }
  }

  // Validate amount
  if (amount < 0) {
    return res.status(400).json({
      success: false,
      message: "Amount cannot be negative",
    });
  }

  // Validate event date is in the future
  const selectedDate = new Date(eventDate);
  const now = new Date();
  if (selectedDate <= now) {
    return res.status(400).json({
      success: false,
      message: "Event date and time must be in the future",
    });
  }

  // Validate description
  if (description && description.trim().length > 1500) {
    return res.status(400).json({
      success: false,
      message: "Description must not exceed 1500 characters",
    });
  }

  // Calculate event creation charge based on scale
  let creationCharge = 0;
  if (totalSeats <= 50) {
    creationCharge = 500;
  } else if (totalSeats <= 100) {
    creationCharge = 1000;
  } else if (totalSeats <= 200) {
    creationCharge = 1500;
  } else if (totalSeats <= 500) {
    creationCharge = 2500;
  } else {
    creationCharge = 5000;
  }

  const event = await Event.create({
    name,
    description: description ? description.trim() : "",
    eventDate,
    totalSeats,
    availableSeats: totalSeats,
    type: type || "public", // Default to public
    category,
    amount,
    currency: currency || "INR",
    creationCharge,
    createdBy: req.body.userId, // Store who created the event
    idempotencyKey: idempotencyKey || null,
    image: image || null, // Store base64 image
  });

  res.status(201).json({
    success: true,
    data: event,
    creationCharge,
    message: `Event created successfully. Creation charge: ₹${creationCharge}`,
  });
};

/**
 * Get all public events (or all events for admin) - EXCLUDES expired events
 */
exports.getAllPublicEvents = async (req, res) => {
  const { userRole } = req.query;
  const now = new Date();

  const notExpiredFilter = {
    $or: [
      { eventType: "multi-day", endDate: { $gt: now } },
      { eventType: { $ne: "multi-day" }, eventDate: { $gt: now } },
      { eventType: "multi-day", endDate: null, eventDate: { $gt: now } },
    ],
  };

  const typeFilter =
    userRole === "admin" || userRole === "superAdmin" ? {} : { type: "public" };

  const filter = { ...typeFilter, ...notExpiredFilter };

  const events = await Event.find(filter)
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ eventDate: 1 });

  res.status(200).json({
    success: true,
    data: events,
  });
};

/**
 * Get expired events (admin/superAdmin only)
 */
exports.getExpiredEvents = async (req, res) => {
  const { userRole } = req.query;

  if (userRole !== "admin" && userRole !== "superAdmin") {
    return res.status(403).json({ success: false, message: "Only admins can view expired events" });
  }

  const now = new Date();
  const expiredFilter = {
    $or: [
      { eventType: "multi-day", endDate: { $lte: now } },
      { eventType: { $ne: "multi-day" }, eventDate: { $lte: now } },
      { eventType: "multi-day", endDate: null, eventDate: { $lte: now } },
    ],
  };

  const events = await Event.find(expiredFilter)
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ eventDate: -1 });

  res.status(200).json({ success: true, data: events });
};

/**
 * Get events created by a specific user
 */
exports.getMyEvents = async (req, res) => {
  const { userId, userRole } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required",
    });
  }

  // Default to "user" if userRole not provided (backward compatibility)
  const role = userRole || "user";

  let filter = {};
  if (role === "superAdmin") {
    filter = {}; // SuperAdmin sees ALL events
  } else if (role === "admin") {
    filter = {
      $or: [{ createdBy: userId }, { approvedBy: userId }],
    };
  } else {
    filter = { createdBy: userId }; // User sees only their created events
  }

  const events = await Event.find(filter)
    .populate("createdBy", "name email _id")
    .populate("approvedBy", "name email _id")
    .select(
      "_id name description eventDate totalSeats availableSeats type category amount currency creationCharge createdAt image approvedBy createdViaRequest createdBy",
    )
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: events,
    count: events.length,
  });
};

/**
 * Update event image
 * SuperAdmin: can update any event
 * Admin: can update events created or approved by them
 * User: can update events they created
 */
exports.updateEventImage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, userRole, image } = req.body;

    if (!userId || !userRole || !image) {
      return res.status(400).json({
        success: false,
        message: "userId, userRole, and image are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const isCreator = event.createdBy && event.createdBy.toString() === userId;
    const isApprover = event.approvedBy && event.approvedBy.toString() === userId;
    const isSuperAdmin = userRole === "superAdmin";
    const isAdmin = userRole === "admin";

    let canEdit = false;
    if (isSuperAdmin) {
      canEdit = true;
    } else if (isAdmin && (isCreator || isApprover)) {
      canEdit = true;
    } else if (userRole === "user" && isCreator) {
      canEdit = true;
    }

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this event's image",
      });
    }

    event.image = image;
    await event.save();

    res.status(200).json({
      success: true,
      message: "Event image updated successfully",
      data: {
        _id: event._id,
        name: event.name,
        image: event.image,
      },
    });
  } catch (error) {
    console.error("Error updating event image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update event image",
      error: error.message,
    });
  }
};

exports.updateEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, userRole, name, description, category, totalSeats, availableSeats } = req.body;

    if (!userId || !userRole) {
      return res.status(400).json({
        success: false,
        message: "userId and userRole are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const isCreator = event.createdBy && event.createdBy.toString() === userId;
    const isApprover = event.approvedBy && event.approvedBy.toString() === userId;
    const isSuperAdmin = userRole === "superAdmin";
    const isAdmin = userRole === "admin";

    let canEdit = false;
    if (isSuperAdmin) {
      canEdit = true;
    } else if (isAdmin && (isCreator || isApprover)) {
      canEdit = true;
    } else if (userRole === "user" && isCreator) {
      canEdit = true;
    }

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this event's details",
      });
    }

    // Update basic fields (all roles can edit)
    if (name) event.name = name;
    if (description) event.description = description;
    if (category) event.category = category;

    // Only superAdmin can change seats
    if (isSuperAdmin) {
      if (totalSeats !== undefined) event.totalSeats = totalSeats;
      if (availableSeats !== undefined) event.availableSeats = availableSeats;
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: "Event details updated successfully",
      data: {
        _id: event._id,
        name: event.name,
        description: event.description,
        category: event.category,
        totalSeats: event.totalSeats,
        availableSeats: event.availableSeats,
      },
    });
  } catch (error) {
    console.error("Error updating event details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update event details",
      error: error.message,
    });
  }
};

/**
 * Delete an event
 * SuperAdmin can delete any event, Admin can only delete events they created
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, userRole } = req.body;

    if (!userId || !userRole) {
      return res.status(400).json({
        success: false,
        message: "userId and userRole are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Authorization check
    const isCreator = event.createdBy && event.createdBy.toString() === userId;
    const isSuperAdmin = userRole === "superAdmin";

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "You can only delete events you created",
      });
    }

    // Check if event has any confirmed bookings
    const Booking = require("../models/Booking.model");
    const confirmedBookings = await Booking.countDocuments({
      event: eventId,
      status: "CONFIRMED",
    });

    if (confirmedBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete event with ${confirmedBookings} confirmed booking(s). Cancel all bookings first.`,
      });
    }

    // Delete the event
    await Event.findByIdAndDelete(eventId);

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete event",
      error: error.message,
    });
  }
};

/**
 * Get event details by ID
 */
exports.getEventById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid event ID",
    });
  }

  const event = await Event.findById(id)
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email");

  if (!event) {
    return res.status(404).json({
      success: false,
      message: "Event not found",
    });
  }

  res.status(200).json({
    success: true,
    data: event,
  });
};

/**
 * Sync all events - Fix seat count inconsistencies for ALL events (SuperAdmin only)
 */
exports.syncAllEvents = async (req, res) => {
  try {
    const { userRole } = req.body;

    if (userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only superAdmin can sync all events",
      });
    }

    const Booking = require("../models/Booking.model");
    const allEvents = await Event.find({});
    const results = [];

    for (const event of allEvents) {
      // Count actual confirmed bookings for this event
      const confirmedBookings = await Booking.find({
        event: event._id,
        status: "CONFIRMED",
      });

      const totalBookedSeats = confirmedBookings.reduce(
        (sum, booking) =>
          sum +
          (Array.isArray(booking.seats)
            ? booking.seats.length
            : booking.seats || 0),
        0,
      );

      const correctAvailableSeats = event.totalSeats - totalBookedSeats;

      // Update if there's a mismatch
      if (event.availableSeats !== correctAvailableSeats) {
        const oldValue = event.availableSeats;
        event.availableSeats = correctAvailableSeats;
        await event.save();

        results.push({
          eventId: event._id,
          eventName: event.name,
          fixed: true,
          oldAvailableSeats: oldValue,
          newAvailableSeats: correctAvailableSeats,
          confirmedBookings: confirmedBookings.length,
          totalBookedSeats,
        });
      } else {
        results.push({
          eventId: event._id,
          eventName: event.name,
          fixed: false,
          availableSeats: event.availableSeats,
          confirmedBookings: confirmedBookings.length,
          totalBookedSeats,
        });
      }
    }

    const fixedCount = results.filter((r) => r.fixed).length;

    res.status(200).json({
      success: true,
      message: `Sync complete. Fixed ${fixedCount} out of ${allEvents.length} events.`,
      data: {
        totalEvents: allEvents.length,
        fixedEvents: fixedCount,
        results,
      },
    });
  } catch (error) {
    console.error("Error syncing all events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync events",
      error: error.message,
    });
  }
};
exports.fixEventSeats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userRole } = req.body;

    if (userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only superAdmin can fix seat inconsistencies",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Count actual confirmed bookings
    const Booking = require("../models/Booking.model");
    const confirmedBookings = await Booking.find({
      event: eventId,
      status: "CONFIRMED",
    });

    const totalBookedSeats = confirmedBookings.reduce(
      (sum, booking) => sum + (Array.isArray(booking.seats) ? booking.seats.length : booking.seats),
      0
    );

    const correctAvailableSeats = event.totalSeats - totalBookedSeats;

    // Update if there's a mismatch
    if (event.availableSeats !== correctAvailableSeats) {
      const oldValue = event.availableSeats;
      event.availableSeats = correctAvailableSeats;
      await event.save();

      return res.status(200).json({
        success: true,
        message: "Seat count fixed successfully",
        data: {
          eventId: event._id,
          totalSeats: event.totalSeats,
          oldAvailableSeats: oldValue,
          newAvailableSeats: correctAvailableSeats,
          confirmedBookings: confirmedBookings.length,
          totalBookedSeats,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Seat count is already correct",
      data: {
        eventId: event._id,
        totalSeats: event.totalSeats,
        availableSeats: event.availableSeats,
        confirmedBookings: confirmedBookings.length,
        totalBookedSeats,
      },
    });
  } catch (error) {
    console.error("Error fixing event seats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fix seat count",
      error: error.message,
    });
  }
};
