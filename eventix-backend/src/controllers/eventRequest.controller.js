// ============================================
// EVENT REQUEST CONTROLLER
// ============================================
// Handles event creation requests from users
// Admin approval flow and platform fee payment

const EventRequest = require("../models/EventRequest.model");
const Event = require("../models/Event.model");
const User = require("../models/User.model");
const Razorpay = require("razorpay");

// Initialize Razorpay lazily so missing env vars don't crash startup
let razorpay;
const getRazorpay = () => {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

// Platform fee in INR (₹5000)
const PLATFORM_FEE = 5000;
const PAYMENT_EXPIRY_HOURS = 48; // 48 hours to pay after approval

// ============================================
// USER: Submit event creation request
// ============================================
exports.submitRequest = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID required" });
    }

    const {
      name,
      description,
      eventType,      // "single-day" | "multi-day"
      eventDate,      // start date
      endDate,        // end date (multi-day only)
      passOptions,    // { dailyPass: { enabled, price }, seasonPass: { enabled, price } }
      totalSeats,
      type,
      category,
      amount,         // single-day ticket price (0 for multi-day)
      currency,
      image,
      idempotencyKey,
    } = req.body;

    // ── Validate required fields ─────────────────────────────
    if (!name || !eventDate || !totalSeats) {
      return res.status(400).json({
        success: false,
        message: "Name, event date, and total seats are required",
      });
    }

    // ── Idempotency check ────────────────────────────────────
    if (idempotencyKey) {
      const existingRequest = await EventRequest.findOne({ idempotencyKey });
      if (existingRequest) {
        await existingRequest.populate("requestedBy", "name email");
        return res.status(200).json({
          success: true,
          message: "Request already submitted (duplicate prevented)",
          eventRequest: existingRequest,
          isRetry: true,
        });
      }
    }

    // ── Validate event date ──────────────────────────────────
    const startDate = new Date(eventDate);
    if (startDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Event start date must be in the future",
      });
    }

    // ── Validate multi-day specifics ─────────────────────────
    const resolvedEventType = eventType || "single-day";

    if (resolvedEventType === "multi-day") {
      if (!endDate) {
        return res.status(400).json({
          success: false,
          message: "End date is required for multi-day events",
        });
      }

      const end = new Date(endDate);
      if (end <= startDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after the start date",
        });
      }

      // At least one pass option must be enabled with a valid price
      const dailyEnabled  = passOptions?.dailyPass?.enabled  && passOptions.dailyPass.price  > 0;
      const seasonEnabled = passOptions?.seasonPass?.enabled && passOptions.seasonPass.price > 0;

      if (!dailyEnabled && !seasonEnabled) {
        return res.status(400).json({
          success: false,
          message:
            "Multi-day events must have at least one pass option (Day Pass or Season Pass) with a price greater than 0",
        });
      }
    }

    // ── Build and save the request ───────────────────────────
    const eventRequestData = {
      name,
      description,
      eventType: resolvedEventType,
      eventDate,
      totalSeats,
      type: type || "public",
      category: category || [],
      amount: resolvedEventType === "single-day" ? (amount || 0) : 0,
      currency: currency || "INR",
      image,
      requestedBy: userId,
      status: "PENDING",
      platformFee: PLATFORM_FEE,
      idempotencyKey: idempotencyKey || null,
    };

    if (resolvedEventType === "multi-day") {
      eventRequestData.endDate = endDate;
      eventRequestData.passOptions = {
        dailyPass: {
          enabled: passOptions?.dailyPass?.enabled || false,
          price:   passOptions?.dailyPass?.price   || 0,
        },
        seasonPass: {
          enabled: passOptions?.seasonPass?.enabled || false,
          price:   passOptions?.seasonPass?.price   || 0,
        },
      };
    }

    const eventRequest = new EventRequest(eventRequestData);
    await eventRequest.save();
    await eventRequest.populate("requestedBy", "name email");

    res.status(201).json({
      success: true,
      message:
        "Event request submitted successfully. Waiting for admin approval.",
      eventRequest,
    });
  } catch (error) {
    console.error("Submit event request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit event request",
      error: error.message,
    });
  }
};

// ============================================
// USER: Get my event requests
// ============================================
exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID required" });
    }

    const requests = await EventRequest.find({ requestedBy: userId })
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .populate("createdEventId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get my requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN: Get all pending requests
// ============================================
exports.getPendingRequests = async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];

    if (userRole !== "admin" && userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin and superAdmin can view pending requests",
      });
    }

    const requests = await EventRequest.find({ status: "PENDING" })
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get pending requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending requests",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN: Get all requests (with filters)
// ============================================
exports.getAllRequests = async (req, res) => {
  try {
    const userRole = req.headers["x-user-role"];

    if (userRole !== "admin" && userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin and superAdmin can view all requests",
      });
    }

    const { status } = req.query;
    const query = status ? { status } : {};

    const requests = await EventRequest.find(query)
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .populate("createdEventId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get all requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN: Approve event request
// ============================================
exports.approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId  = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];
    const { adminNote } = req.body;

    if (userRole !== "admin" && userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin and superAdmin can approve requests",
      });
    }

    const eventRequest = await EventRequest.findById(requestId);
    if (!eventRequest) {
      return res.status(404).json({ success: false, message: "Event request not found" });
    }

    if (eventRequest.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${eventRequest.status.toLowerCase()}`,
      });
    }

    const paymentExpiresAt = new Date();
    paymentExpiresAt.setHours(paymentExpiresAt.getHours() + PAYMENT_EXPIRY_HOURS);

    eventRequest.status           = "APPROVED";
    eventRequest.reviewedBy       = adminId;
    eventRequest.reviewedAt       = new Date();
    eventRequest.adminNote        = adminNote || "Your event request has been approved!";
    eventRequest.paymentExpiresAt = paymentExpiresAt;

    await eventRequest.save();
    await eventRequest.populate("requestedBy", "name email");
    await eventRequest.populate("reviewedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Event request approved. User will be notified to pay platform fee.",
      eventRequest,
    });
  } catch (error) {
    console.error("Approve request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve request",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN: Reject event request
// ============================================
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId  = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];
    const { adminNote } = req.body;

    if (userRole !== "admin" && userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Only admin and superAdmin can reject requests",
      });
    }

    const eventRequest = await EventRequest.findById(requestId);
    if (!eventRequest) {
      return res.status(404).json({ success: false, message: "Event request not found" });
    }

    if (eventRequest.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${eventRequest.status.toLowerCase()}`,
      });
    }

    eventRequest.status     = "REJECTED";
    eventRequest.reviewedBy = adminId;
    eventRequest.reviewedAt = new Date();
    eventRequest.adminNote  = adminNote || "Your event request has been rejected.";

    await eventRequest.save();
    await eventRequest.populate("requestedBy", "name email");
    await eventRequest.populate("reviewedBy", "name email");

    res.status(200).json({ success: true, message: "Event request rejected", eventRequest });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject request",
      error: error.message,
    });
  }
};

// ============================================
// USER: Create payment order for platform fee
// ============================================
exports.createPaymentOrder = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID required" });
    }

    const eventRequest = await EventRequest.findById(requestId);
    if (!eventRequest) {
      return res.status(404).json({ success: false, message: "Event request not found" });
    }

    if (eventRequest.requestedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only pay for your own event requests",
      });
    }

    if (eventRequest.status !== "APPROVED" && eventRequest.status !== "PAYMENT_PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot pay for ${eventRequest.status.toLowerCase()} request`,
      });
    }

    if (eventRequest.paymentExpiresAt && new Date() > eventRequest.paymentExpiresAt) {
      eventRequest.status = "EXPIRED";
      await eventRequest.save();
      return res.status(400).json({
        success: false,
        message: "Payment window has expired. Please submit a new request.",
      });
    }

    const razorpayOrder = await getRazorpay().orders.create({
      amount: eventRequest.platformFee * 100,
      currency: "INR",
      receipt: `evtreq_${requestId.slice(-10)}`,
      notes: { type: "event_request", requestId, userId },
    });

    eventRequest.razorpayOrderId = razorpayOrder.id;
    eventRequest.status = "PAYMENT_PENDING";
    await eventRequest.save();

    res.status(200).json({
      success: true,
      message: "Payment order created",
      order: {
        id:       razorpayOrder.id,
        amount:   razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      platformFee: eventRequest.platformFee,
      eventRequest: { id: eventRequest._id, name: eventRequest.name },
    });
  } catch (error) {
    console.error("Create payment order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// ============================================
// USER: Verify payment and create event
// ============================================
exports.verifyPaymentAndCreateEvent = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.headers["x-user-id"];
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID required" });
    }

    const eventRequest = await EventRequest.findById(requestId);
    if (!eventRequest) {
      return res.status(404).json({ success: false, message: "Event request not found" });
    }

    if (eventRequest.requestedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only verify payment for your own requests",
      });
    }

    if (eventRequest.status !== "PAYMENT_PENDING" && eventRequest.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: `Cannot process payment for ${eventRequest.status.toLowerCase()} request`,
      });
    }

    // ── Verify Razorpay signature ─────────────────────────────
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      eventRequest.paymentStatus = "FAILED";
      await eventRequest.save();
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // ── Create the Event ─────────────────────────────────────
    const eventPayload = {
      name:             eventRequest.name,
      description:      eventRequest.description,
      eventType:        eventRequest.eventType || "single-day",
      eventDate:        eventRequest.eventDate,
      totalSeats:       eventRequest.totalSeats,
      availableSeats:   eventRequest.totalSeats,
      type:             eventRequest.type,
      category:         eventRequest.category,
      amount:           eventRequest.amount,
      currency:         eventRequest.currency,
      image:            eventRequest.image,
      createdBy:        eventRequest.requestedBy,
      approvedBy:       eventRequest.reviewedBy,
      createdViaRequest: true,
      eventRequestId:   eventRequest._id,
      isPublished:      true,
      paymentStatus:    "PAID",
      creationFee:      eventRequest.platformFee,
    };

    // Add multi-day fields if applicable
    if (eventRequest.eventType === "multi-day") {
      const { generateDailySeatsMap } = require("../utils/seatManager");
      eventPayload.endDate     = eventRequest.endDate;
      eventPayload.passOptions = eventRequest.passOptions;
      // Populate per-day seat inventory
      eventPayload.dailySeats  = generateDailySeatsMap(
        eventRequest.eventDate,
        eventRequest.endDate,
        eventRequest.totalSeats,
      );
    }

    const event = new Event(eventPayload);
    await event.save();

    // ── Update event request ──────────────────────────────────
    eventRequest.status           = "COMPLETED";
    eventRequest.paymentStatus    = "PAID";
    eventRequest.razorpayPaymentId = razorpay_payment_id;
    eventRequest.createdEventId   = event._id;
    await eventRequest.save();

    await event.populate("createdBy", "name email");
    await event.populate("approvedBy", "name email");

    res.status(201).json({
      success: true,
      message: "Payment successful! Your event has been created.",
      event,
      eventRequest: { id: eventRequest._id, status: eventRequest.status },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

// ============================================
// Get single event request details
// ============================================
exports.getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId   = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    const eventRequest = await EventRequest.findById(requestId)
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .populate("createdEventId", "name");

    if (!eventRequest) {
      return res.status(404).json({ success: false, message: "Event request not found" });
    }

    const isOwner = eventRequest.requestedBy._id.toString() === userId;
    const isAdmin = userRole === "admin" || userRole === "superAdmin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this request",
      });
    }

    res.status(200).json({ success: true, eventRequest });
  } catch (error) {
    console.error("Get request by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch request",
      error: error.message,
    });
  }
};
