// ============================================
// OTP MODEL - Stores temporary OTPs in MongoDB
// ============================================

const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  // The email address the OTP was sent to
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  // The 6-digit OTP code
  otp: {
    type: String,
    required: true,
  },

  // Whether this OTP is for registration or login
  purpose: {
    type: String,
    enum: ["register", "login"],
    required: true,
  },

  // Temporary data stored during registration (name, password, requestAdmin)
  // This is so we don't create the user until OTP is verified
  tempData: {
    type: Object,
    default: null,
  },

  // When this OTP was created
  // MongoDB TTL index: automatically deletes this document after 600 seconds (10 minutes)
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // 10 minutes in seconds
  },
});

// UNIQUE compound index on {email, purpose}
// This is the key to preventing race conditions:
// MongoDB will atomically reject a second insert for the same email+purpose,
// even if two requests arrive at the exact same millisecond.
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model("Otp", otpSchema);
