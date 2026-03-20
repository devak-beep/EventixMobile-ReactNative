// ============================================
// DATABASE CONNECTION SETUP
// Connects the app to MongoDB database
// ============================================

const mongoose = require("mongoose");

// Increase mongoose buffering timeout to 30 seconds
mongoose.set("bufferTimeoutMS", 30000);

// Track connection state
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  console.log("[DB] Connecting to MongoDB...");
  console.log("[DB] URI exists:", !!process.env.MONGO_URI);

  connectionPromise = mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  });

  try {
    await connectionPromise;
    console.log(
      "[DB] MongoDB connected successfully, state:",
      mongoose.connection.readyState,
    );
    return;
  } catch (error) {
    connectionPromise = null;
    console.error("[DB] MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;
