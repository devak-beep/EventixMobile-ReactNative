// ============================================
// EVENT REQUEST ROUTES
// ============================================
// Routes for event creation request workflow

const express = require("express");
const router = express.Router();
const eventRequestController = require("../controllers/eventRequest.controller");

// Note: Authentication is handled via headers (x-user-id, x-user-role)
// which are validated in the controller methods

// ============================================
// ADMIN ROUTES (must be before /:requestId to avoid conflicts)
// ============================================

// Get all pending requests (admin only)
// GET /api/event-requests/admin/pending
router.get("/admin/pending", eventRequestController.getPendingRequests);

// Get all requests with optional filter (admin only)
// GET /api/event-requests/admin/all?status=PENDING
router.get("/admin/all", eventRequestController.getAllRequests);

// ============================================
// USER ROUTES
// ============================================

// Submit a new event request
// POST /api/event-requests
router.post("/", eventRequestController.submitRequest);

// Get my event requests
// GET /api/event-requests/my-requests
router.get("/my-requests", eventRequestController.getMyRequests);

// Get single request by ID (must be after /admin/* and /my-requests)
// GET /api/event-requests/:requestId
router.get("/:requestId", eventRequestController.getRequestById);

// Create payment order for platform fee
// POST /api/event-requests/:requestId/create-order
router.post(
  "/:requestId/create-order",
  eventRequestController.createPaymentOrder,
);

// Verify payment and create event
// POST /api/event-requests/:requestId/verify-payment
router.post(
  "/:requestId/verify-payment",
  eventRequestController.verifyPaymentAndCreateEvent,
);

// Approve a request (admin only)
// PUT /api/event-requests/:requestId/approve
router.put("/:requestId/approve", eventRequestController.approveRequest);

// Reject a request (admin only)
// PUT /api/event-requests/:requestId/reject
router.put("/:requestId/reject", eventRequestController.rejectRequest);

module.exports = router;
