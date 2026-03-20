# 📚 Complete Backend Code Guide with Comments

**For Beginners - Understanding Event Booking Backend**

This guide explains every line of code in the event-booking-backend project. Perfect for learning backend development!

---

## 📁 Project Structure Overview

```
event-booking-backend/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server startup (entry point)
│   ├── config/
│   │   └── db.js              # MongoDB connection setup
│   ├── models/                # Database schemas (MongoDB)
│   ├── controllers/           # Business logic for API endpoints
│   ├── services/              # Reusable functions
│   ├── routes/                # API endpoint definitions
│   ├── middlewares/           # Error handling, authentication
│   ├── jobs/                  # Background jobs (runs every minute)
│   └── utils/                 # Helper functions
├── package.json               # Dependencies list
└── .env                       # Environment variables
```

---

## 🚀 Entry Point: How Server Starts

### **File: src/server.js**

```javascript
// Load environment variables from .env file
// Example: PORT=3000, MONGO_URI=mongodb://...
require("dotenv").config();

// Import Express app (contains all routes)
const app = require("./app");

// Import MongoDB connection function
const connectDB = require("./config/db");

// EPIC 6: Import background jobs (cleanup tasks)
const recoverFromFailures = require("./jobs/failureRecovery.job");
const expireBookings = require("./jobs/bookingExpiry.job");
const expireLocks = require("./jobs/lockExpiry.job");

// Get port from .env file, or use 3000 if not set
const PORT = process.env.PORT || 3000;

// This function runs when server starts
const startServer = async () => {
  // Step 1: Connect to MongoDB database
  await connectDB();

  // Step 2: Run cleanup job on startup to fix any broken state
  // (If locks/bookings are stuck, this fixes them)
  try {
    await recoverFromFailures();
  } catch (error) {
    console.error(
      "Failed to complete recovery, proceeding with startup...",
      error.message,
    );
  }

  // Step 3: Log that jobs are starting
  // These jobs run automatically every 1 minute
  console.log("[JOBS] Lock expiry job started (runs every 1 minute)");
  console.log("[JOBS] Booking expiry job started (runs every 1 minute)");

  // Step 4: Start listening for API requests on the port
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Run the startup function when this file is executed
startServer();
```

---

## 🔌 Express App Setup: src/app.js

```javascript
// Import Express framework
const express = require("express");

// Import middleware that catches async errors automatically
// (Without this, errors in async functions would crash the server)
require("express-async-errors");

// Import all route files
const userRoutes = require("./routes/user.routes");
const eventRoutes = require("./routes/event.routes");
const lockRoutes = require("./routes/lock.routes");
const bookingRoutes = require("./routes/booking.routes");

// Create Express app instance
const app = express();

// Middleware: Enable JSON parsing
// (This allows the server to read JSON from request bodies)
app.use(express.json());

// Register routes at different URLs
// Example: POST /api/users/register → user.routes.js
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/locks", lockRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", require("./routes/payment.routes"));

// Health check endpoint
// When you GET /health, server responds with {"status":"OK"}
// (Used to check if server is alive)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Export app so server.js can use it
module.exports = app;
```

---

## 🗄️ Database Connection: src/config/db.js

```javascript
// Import Mongoose (MongoDB driver for Node.js)
const mongoose = require("mongoose");

// Create async function to connect to MongoDB
const connectDB = async () => {
  try {
    // Connect to MongoDB using URL from .env file
    // Example: mongodb://127.0.0.1:27017/event_booking?replicaSet=rs0
    await mongoose.connect(process.env.MONGO_URI);

    // Log success message when connected
    console.log("MongoDB connected");
  } catch (error) {
    // If connection fails, log error and stop server
    console.error("MongoDB connection failed:", error.message);
    process.exit(1); // Exit with error code 1
  }
};

// Export function so server.js can use it
module.exports = connectDB;
```

---

## 📊 Database Models (Schemas)

A **model** is like a blueprint for data. It defines what fields a document should have and what type each field is.

### **Model 1: User - src/models/User.model.js**

```javascript
// Import Mongoose library
const mongoose = require("mongoose");

// Define what fields a User should have
const userSchema = new mongoose.Schema(
  {
    // Field: name
    // - type: String (text)
    // - required: true (must provide a name)
    // - trim: true (remove extra spaces)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Field: email
    // - type: String
    // - required: true (every user must have email)
    // - unique: true (no two users can have same email)
    // - lowercase: true (convert "JOHN@GMAIL.COM" to "john@gmail.com")
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    // Field: password (encrypted)
    password: {
      type: String,
      required: true,
    },

    // Field: role (admin or regular user)
    role: {
      type: String,
      enum: ["user", "admin"], // Can only be "user" or "admin"
      default: "user", // If not provided, default is "user"
    },
  },
  // Option: Add createdAt and updatedAt timestamps automatically
  { timestamps: true },
);

// Create and export User model
// MongoDB collection name will be "users"
module.exports = mongoose.model("User", userSchema);
```

### **Model 2: Event - src/models/Event.model.js**

```javascript
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    // Field: Event name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Field: Event description
    description: {
      type: String,
      trim: true,
    },

    // Field: When the event happens
    // index: true means create a database index for faster searches
    eventDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Field: How many total seats available
    // min: 1 means at least 1 seat required
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "Total seats must be at least 1"],
    },

    // Field: How many seats are still available (not booked)
    // Starts equal to totalSeats
    // When someone books, this decreases
    availableSeats: {
      type: Number,
      required: true,
      min: [0, "Available seats cannot be negative"],
      // Custom validation: available can't exceed total
      validate: {
        validator: function (value) {
          return value <= this.totalSeats;
        },
        message: "Available seats cannot exceed total seats",
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Event", eventSchema);
```

### **Model 3: SeatLock - src/models/SeatLock.model.js**

```javascript
const mongoose = require("mongoose");

// A SeatLock reserves seats for a user while they complete payment
// Example: User locks 3 seats for 5 minutes to pay
const seatLockSchema = new mongoose.Schema(
  {
    // Field: Which event these seats belong to
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event", // Link to Event model
      required: true,
    },

    // Field: Which user locked these seats
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Field: How many seats are locked
    seats: {
      type: Number,
      required: true,
      min: 1,
    },

    // Field: Lock status
    // - ACTIVE: Lock is valid, user can still pay
    // - EXPIRED: Lock expired, seats released back to event
    // - CONSUMED: Lock converted to booking (payment done)
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CONSUMED"],
      default: "ACTIVE",
    },

    // Field: When does this lock expire
    // If user doesn't complete payment by this time, lock expires
    expiresAt: {
      type: Date,
      required: true,
    },

    // Field: Unique key for idempotency
    // If network fails and user retries, we use this to avoid duplicates
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

// Create database index on expiresAt for fast searches
// Useful when job searches for expired locks
seatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Delete old model if it exists (prevents conflicts)
if (mongoose.models.SeatLock) {
  delete mongoose.models.SeatLock;
}

module.exports = mongoose.model("SeatLock", seatLockSchema);
```

### **Model 4: Booking - src/models/Booking.model.js**

```javascript
const mongoose = require("mongoose");

// Define all possible booking statuses
const BOOKING_STATUS = {
  INITIATED: "INITIATED", // Booking just started
  PAYMENT_PENDING: "PAYMENT_PENDING", // Waiting for payment
  CONFIRMED: "CONFIRMED", // Payment received, booking confirmed
  CANCELLED: "CANCELLED", // User cancelled
  EXPIRED: "EXPIRED", // Payment time expired
  FAILED: "FAILED", // Payment failed
};

const bookingSchema = new mongoose.Schema(
  {
    // Field: Which user made this booking
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Field: Which event is being booked
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // Field: Idempotency key (for duplicate prevention)
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Field: Which seat numbers (e.g., ["A1", "A2", "A3"])
    seats: {
      type: [String],
      required: true,
    },

    // Field: Current booking status
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.INITIATED,
    },

    // Field: Link to the SeatLock that reserved these seats
    seatLockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeatLock",
      unique: true,
    },

    // Field: When payment must be completed
    // If not paid by this time, booking expires
    paymentExpiresAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
```

---

## 🛣️ Routes (API Endpoints)

Routes define what URLs your API responds to and what controller handles each request.

### **Example: User Routes - src/routes/user.routes.js**

```javascript
// Import Express routing library
const express = require("express");

// Import controller (has the actual logic)
const { registerUser, getUser } = require("../controllers/user.controller");

// Create router for user endpoints
const router = express.Router();

// Define routes:

// POST /api/users/register
// When user sends POST request to register, call registerUser function
router.post("/register", registerUser);

// GET /api/users/:userId
// When user sends GET request for specific user, call getUser function
router.get("/:userId", getUser);

// Export router so app.js can use it
module.exports = router;
```

---

## 🎯 Controllers (Business Logic)

Controllers contain the actual logic for handling API requests. They receive requests, process data, and send responses.

### **Example: User Controller - src/controllers/user.controller.js**

Read this file to see how controllers work:

```javascript
// Import User model to interact with database
const User = require("../models/User.model");

// Function to handle user registration
const registerUser = async (req, res) => {
  // Extract name and email from request body
  const { name, email } = req.body;

  // Check if user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: "Email already registered" });
  }

  // Create new user in database
  // Note: In production, hash the password first!
  const newUser = await User.create({
    name,
    email,
    password: "default", // Simplified for testing
  });

  // Send success response with created user
  res.status(201).json({
    success: true,
    data: newUser,
  });
};

// Function to get a specific user
const getUser = async (req, res) => {
  // Get userId from URL parameter
  const { userId } = req.params;

  // Find user in database
  const user = await User.findById(userId);

  // If user not found, return error
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Return the user
  res.json({
    success: true,
    data: user,
  });
};

// Export functions so routes can use them
module.exports = {
  registerUser,
  getUser,
};
```

---

## 🔄 Services (Reusable Functions)

Services contain functions that are used by multiple controllers. They prevent code duplication.

### **Example: Booking Service - src/services/booking.service.js**

```javascript
// Import models
const Booking = require("../models/Booking.model");
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");

// Reusable function to check if booking is expired
const isBookingExpired = (booking) => {
  // If paymentExpiresAt is before now, it's expired
  return new Date() > new Date(booking.paymentExpiresAt);
};

// Reusable function to release locked seats
const releaseLockedSeats = async (lockId, eventId) => {
  // Find the lock
  const lock = await SeatLock.findById(lockId);
  if (!lock) return;

  // Add seats back to event
  // $inc operator increases availableSeats by the number locked
  await Event.findByIdAndUpdate(eventId, {
    $inc: { availableSeats: lock.seats },
  });

  // Mark lock as expired
  await SeatLock.findByIdAndUpdate(lockId, { status: "EXPIRED" });
};

module.exports = {
  isBookingExpired,
  releaseLockedSeats,
};
```

---

## 🔧 Background Jobs (Run Every Minute)

Jobs are tasks that run automatically in the background. Your system has 3 jobs:

### **Job 1: Lock Expiry - src/jobs/lockExpiry.job.js**

```javascript
// Import models
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");
const cron = require("node-cron");

// This function runs every 1 minute to clean up expired locks
const lockExpiryJob = async () => {
  try {
    // Find all ACTIVE locks that have expired
    // expiresAt < now means the lock time has passed
    const expiredLocks = await SeatLock.find({
      status: "ACTIVE",
      expiresAt: { $lt: new Date() },
    });

    // If no expired locks, just log and return
    if (expiredLocks.length === 0) {
      console.log("[LOCK EXPIRY JOB] Found 0 expired locks");
      return;
    }

    // Log how many locks found
    console.log(`[LOCK EXPIRY JOB] Found ${expiredLocks.length} expired locks`);

    // For each expired lock:
    for (const lock of expiredLocks) {
      // Mark lock as EXPIRED
      await SeatLock.findByIdAndUpdate(lock._id, { status: "EXPIRED" });

      // Release the locked seats back to the event
      // Use $inc to atomically increase availableSeats
      await Event.findByIdAndUpdate(lock.eventId, {
        $inc: { availableSeats: lock.seats },
      });

      // Log success
      console.log(
        `[LOCK EXPIRY JOB] Expired lock ${lock._id}, restored ${lock.seats} seats`,
      );
    }

    console.log(
      `[LOCK EXPIRY JOB] Successfully expired ${expiredLocks.length} locks`,
    );
  } catch (error) {
    console.error("[LOCK EXPIRY JOB] Error:", error.message);
  }
};

// Schedule job to run every 1 minute
// "*/1 * * * *" is cron syntax meaning "every minute"
cron.schedule("*/1 * * * *", lockExpiryJob);

module.exports = lockExpiryJob;
```

### **Job 2: Booking Expiry - src/jobs/bookingExpiry.job.js**

```javascript
// Import models and services
const Booking = require("../models/Booking.model");
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");
const cron = require("node-cron");

// This job runs every 1 minute to clean up expired bookings (unpaid)
const bookingExpiryJob = async () => {
  try {
    // Find all PAYMENT_PENDING bookings where payment time expired
    const expiredBookings = await Booking.find({
      status: "PAYMENT_PENDING",
      paymentExpiresAt: { $lt: new Date() },
    });

    if (expiredBookings.length === 0) {
      console.log("[BOOKING EXPIRY JOB] Found 0 expired bookings");
      return;
    }

    console.log(
      `[BOOKING EXPIRY JOB] Found ${expiredBookings.length} expired bookings`,
    );

    // For each expired booking:
    for (const booking of expiredBookings) {
      // Find the lock associated with this booking
      const lock = await SeatLock.findById(booking.seatLockId);

      if (lock) {
        // Mark lock as EXPIRED
        await SeatLock.findByIdAndUpdate(lock._id, {
          status: "EXPIRED",
        });

        // Release seats back to event
        await Event.findByIdAndUpdate(booking.event, {
          $inc: { availableSeats: lock.seats },
        });
      }

      // Mark booking as EXPIRED
      await Booking.findByIdAndUpdate(booking._id, {
        status: "EXPIRED",
      });

      console.log(`[BOOKING EXPIRY JOB] Expired booking ${booking._id}`);
    }

    console.log(
      `[BOOKING EXPIRY JOB] Successfully expired ${expiredBookings.length} bookings`,
    );
  } catch (error) {
    console.error("[BOOKING EXPIRY JOB] Error:", error.message);
  }
};

// Run every 1 minute
cron.schedule("*/1 * * * *", bookingExpiryJob);

module.exports = bookingExpiryJob;
```

### **Job 3: Failure Recovery - src/jobs/failureRecovery.job.js**

```javascript
// This job runs ONCE on server startup to fix any broken state
// Example: If server crashes with locks still active, this releases them

const Booking = require("../models/Booking.model");
const SeatLock = require("../models/SeatLock.model");
const Event = require("../models/Event.model");

const failureRecovery = async () => {
  try {
    console.log("[RECOVERY] Starting system recovery...");

    // Step 1: Find all ACTIVE locks that expired before server crashed
    const staleActiveLocks = await SeatLock.find({
      status: "ACTIVE",
      expiresAt: { $lt: new Date() },
    });

    // Step 2: Find all PAYMENT_PENDING bookings with expired payment time
    const staleBookings = await Booking.find({
      status: "PAYMENT_PENDING",
      paymentExpiresAt: { $lt: new Date() },
    });

    // Step 3: For each stale lock, release seats
    for (const lock of staleActiveLocks) {
      await SeatLock.findByIdAndUpdate(lock._id, { status: "EXPIRED" });
      await Event.findByIdAndUpdate(lock.eventId, {
        $inc: { availableSeats: lock.seats },
      });
      console.log(
        `[RECOVERY] Released ${lock.seats} seats from stale lock ${lock._id}`,
      );
    }

    // Step 4: For each stale booking, release its lock's seats
    for (const booking of staleBookings) {
      const lock = await SeatLock.findById(booking.seatLockId);
      if (lock) {
        await SeatLock.findByIdAndUpdate(lock._id, { status: "EXPIRED" });
        await Event.findByIdAndUpdate(booking.event, {
          $inc: { availableSeats: lock.seats },
        });
      }
      await Booking.findByIdAndUpdate(booking._id, {
        status: "EXPIRED",
      });
      console.log(`[RECOVERY] Expired stale booking ${booking._id}`);
    }

    console.log("[RECOVERY] ✅ System recovery completed successfully");
  } catch (error) {
    console.error("[RECOVERY] Error during recovery:", error.message);
    throw error;
  }
};

module.exports = failureRecovery;
```

---

## 🧪 How It All Works Together

### **Scenario: User Books Event Seats**

1. **User sends POST /api/bookings/create** with event ID and seats
2. **Controller** receives request and calls service function
3. **Service** validates data and creates SeatLock (reserves seats)
4. **SeatLock reduces event.availableSeats** (seats are now locked)
5. **User has 5 minutes** to complete payment
6. **If payment completed:** Lock status → CONSUMED, Booking → CONFIRMED
7. **If 5 minutes pass without payment:**
   - Job detects expired lock
   - Job releases seats (increases availableSeats)
   - Lock status → EXPIRED, Booking → EXPIRED

---

## 📚 Key Concepts for Beginners

### **What is a Route?**

A route is a URL endpoint your API listens to. Example:

```
POST /api/bookings/create → Creates a booking
GET /api/events/123 → Gets event with ID 123
```

### **What is a Controller?**

Code that handles what happens when a request comes in. It gets data, processes it, and sends back a response.

### **What is a Service?**

Reusable functions that controllers can call. Prevents writing the same code twice.

### **What is a Model?**

A blueprint for database documents. Defines what fields are required and their types.

### **What is a Job?**

Background tasks that run automatically. Your jobs clean up expired data every minute.

### **Why Use Jobs?**

Without jobs, expired locks/bookings would stay in the database forever. Jobs keep the system clean.

---

## ⚙️ Installation & Running

```bash
# Install dependencies
npm install

# Create .env file with:
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/event_booking?replicaSet=rs0
NODE_ENV=development

# Run server
npm run dev

# Server starts and:
# 1. Connects to MongoDB
# 2. Runs recovery job once
# 3. Starts background jobs (run every minute)
# 4. Listens for API requests on port 3000
```

---

## 🎓 Learning Path

1. **Understand Models** - What data does your system have?
2. **Understand Routes** - What URLs does your API support?
3. **Understand Controllers** - How does each URL get handled?
4. **Understand Services** - What reusable functions exist?
5. **Understand Jobs** - What background tasks run?
6. **Understand Flow** - How does all code work together?

---

## 📖 Next Steps

1. Read the actual files while using this guide
2. Try modifying code and see what breaks
3. Test API endpoints with curl or Postman
4. Add your own endpoints
5. Deploy to production!

Happy learning! 🚀
