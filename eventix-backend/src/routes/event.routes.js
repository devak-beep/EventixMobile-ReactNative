// ============================================
// EVENT ROUTES - API endpoints for event operations
// ============================================

// Import Express router
const express = require("express");
// Create router instance
const router = express.Router();

// Import controller functions
const {
  createEvent,
  getEventById,
  getAllPublicEvents,
  getMyEvents,
  updateEventImage,
  updateEventDetails,
  deleteEvent,
  fixEventSeats,
  syncAllEvents,
} = require("../controllers/event.controller");

const { lockSeats } = require("../controllers/lock.controller");

// Import auth middleware
const { requireAdmin } = require("../middlewares/auth.middleware");

// ROUTE 1: POST /api/events
// Purpose: Create a new event (Admin only)
// Handler: createEvent function
// Request body: {name, description, eventDate, totalSeats, type, userId, userRole}
// Response: {success: true, data: event}
router.post("/", requireAdmin, createEvent);

// ROUTE 1.5: POST /api/events/sync-all
// Purpose: Sync all events - fix seat inconsistencies (SuperAdmin only)
// Handler: syncAllEvents function
// Request body: {userRole}
// Response: {success: true, message, data}
router.post("/sync-all", syncAllEvents);

// ROUTE 2: GET /api/events
// Purpose: Get all public events
// Handler: getAllPublicEvents function
// Response: {success: true, data: [events]}
router.get("/", getAllPublicEvents);

// ROUTE 2.5: GET /api/events/my-events
// Purpose: Get events created by user
// Handler: getMyEvents function
// Query param: userId
// Response: {success: true, data: [events]}
router.get("/my-events", getMyEvents);

// ROUTE 3: GET /api/events/:id
// Purpose: Get event details by ID
// Handler: getEventById function
// URL parameter: id (event's MongoDB ID)
// Response: {success: true, data: event}
router.get("/:id", getEventById);

// ROUTE 3: POST /api/events/:eventId/lock
// Purpose: Lock seats for an event (reserve seats while user pays)
// Handler: lockSeats function
// URL parameter: eventId
// Request body: {seats, idempotencyKey}
// Response: {success: true, lockId, expiresAt}
router.post("/:eventId/lock", lockSeats);

// ROUTE 4: PATCH /api/events/:eventId/image
// Purpose: Update event image (SuperAdmin: any, Admin: created/approved, User: own)
// Handler: updateEventImage function
// URL parameter: eventId
// Request body: {userId, userRole, image}
// Response: {success: true, message, data}
router.patch("/:eventId/image", updateEventImage);

// ROUTE 4.1: PATCH /api/events/:eventId/details
// Purpose: Update event name/description (SuperAdmin: any, Admin: created/approved, User: own)
// Handler: updateEventDetails function
// URL parameter: eventId
// Request body: {userId, userRole, name, description}
// Response: {success: true, message, data}
router.patch("/:eventId/details", updateEventDetails);

// ROUTE 4.2: POST /api/events/:eventId/fix-seats
// Purpose: Fix seat count inconsistencies (SuperAdmin only)
// Handler: fixEventSeats function
// URL parameter: eventId
// Request body: {userRole}
// Response: {success: true, message, data}
router.post("/:eventId/fix-seats", fixEventSeats);

// ROUTE 5: DELETE /api/events/:eventId
// Purpose: Delete an event (SuperAdmin can delete any, Admin only their own)
// Handler: deleteEvent function
// URL parameter: eventId
// Request body: {userId, userRole}
// Response: {success: true, message}
router.delete("/:eventId", requireAdmin, deleteEvent);

// Export router so app.js can use it
module.exports = router;
