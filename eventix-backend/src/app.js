// ============================================
// EXPRESS APP CONFIGURATION
// Sets up Express server with routes and middleware
// ============================================

// Import Express framework
const express = require("express");
// Import CORS to allow frontend to talk to backend
const cors = require("cors");
// Import mongoose to check DB state
const mongoose = require("mongoose");
// Import middleware for automatic error handling in async functions
// Without this, errors in async functions would crash the server
require("express-async-errors");

// Import middleware
const correlationMiddleware = require("./middlewares/correlation.middleware");
const errorMiddleware = require("./middlewares/error.middleware");
const connectDB = require("./config/db");

// Import all route files
const userRoutes = require("./routes/user.routes"); // User registration/retrieval routes
const eventRoutes = require("./routes/event.routes"); // Event creation/retrieval routes
const lockRoutes = require("./routes/lock.routes"); // Seat locking routes
const bookingRoutes = require("./routes/booking.routes"); // Booking confirmation routes

// Create Express app instance
const app = express();

// MIDDLEWARE: Enable CORS (allows frontend to talk to backend)
// Regex covers ALL vercel.app preview + production deployments for this project
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const allowed = [
        /^http:\/\/localhost:\d+$/, // any localhost port
        /^https:\/\/eventix-frontend[^.]*\.vercel\.app$/, // all eventix-frontend-*.vercel.app
        /^https:\/\/eventix[^.]*\.vercel\.app$/, // any eventix*.vercel.app variant
        "https://eventix-frontend-8v2j.vercel.app", // explicit production frontend
      ];

      const isAllowed = allowed.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Correlation-ID",
      "x-user-id",
      "x-user-role",
    ],
  }),
);

// Handle preflight OPTIONS requests for all routes
app.options("*", cors());

// MIDDLEWARE: Correlation ID for request tracking
app.use(correlationMiddleware);

// MIDDLEWARE: Enable JSON parsing
// This allows the server to read JSON from request bodies
// Example: POST /api/users/register with {"name": "John"}
// Increase limit to handle base64 images (10MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// MIDDLEWARE: Ensure database is connected before processing requests
app.use(async (req, res, next) => {
  // Skip DB check for health endpoint
  if (req.path === "/health") {
    return next();
  }

  try {
    // Always ensure DB is connected - connectDB handles state checking internally
    await connectDB();
    next();
  } catch (error) {
    console.error("[APP] DB connection error:", error.message);
    res.status(500).json({
      success: false,
      error: "Database connection failed",
      details: error.message,
    });
  }
});

// REGISTER ROUTES: Mount route handlers at different API endpoints
// Example: POST /api/users/register → handled by userRoutes
app.use("/api/users", userRoutes); // Routes: POST /register, GET /:id
app.use("/api/events", eventRoutes); // Routes: POST /, GET /:id, POST /:eventId/lock
app.use("/api/locks", lockRoutes); // Route: POST /
app.use("/api/bookings", bookingRoutes); // Routes: POST /confirm, POST /:id/confirm
app.use("/api/payments", require("./routes/payment.routes")); // Route: POST /intent
app.use("/api/stripe", require("./routes/stripe.routes")); // Stripe payment routes
app.use("/api/razorpay", require("./routes/razorpay.routes")); // Razorpay payment routes
app.use("/api/jobs", require("./routes/job.routes")); // Routes: POST /expire-locks, /expire-bookings, /recover
app.use("/api/audit", require("./routes/audit.routes")); // Routes: GET /, GET /:bookingId
app.use("/api/reports", require("./routes/reports.routes")); // Routes: GET /booking-summary, GET /health-metrics
app.use("/api/cancellations", require("./routes/cancellation.routes")); // Route: POST /:bookingId/cancel
app.use("/api/event-requests", require("./routes/eventRequest.routes")); // Event creation request workflow

// HEALTH CHECK ENDPOINT
// GET /health → {"status": "OK"}
// Used to check if server is running without any errors
// DevOps tools use this to monitor server health
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// ERROR HANDLING MIDDLEWARE (must be last)
app.use(errorMiddleware);

// Export app so server.js can use it
module.exports = app;
