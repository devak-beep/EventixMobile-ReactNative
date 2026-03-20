// ============================================
// USER MODEL - Database schema for users
// ============================================

// Import Mongoose library for MongoDB
const mongoose = require("mongoose");

// Define what fields a User document should have in the database
const userSchema = new mongoose.Schema(
  {
    // FIELD: User's full name
    name: {
      type: String, // Data type: text string
      required: true, // This field must be provided (cannot be empty)
      trim: true, // Remove leading/trailing whitespace automatically
    },

    // FIELD: User's email address
    email: {
      type: String,
      required: true,
      unique: true, // No two users can have the same email address
      lowercase: true, // Convert to lowercase for consistency ("JOHN@GMAIL.COM" → "john@gmail.com")
    },

    // FIELD: User's password (encrypted)
    password: {
      type: String,
      required: true,
      // ⚠️ NOTE: In production, this should be hashed using bcrypt or similar!
    },

    // FIELD: User's role (determines permissions)
    role: {
      type: String,
      enum: ["user", "admin", "superAdmin"], // Can be user, admin, or superAdmin
      default: "user", // If not specified, defaults to "user"
    },

    // FIELD: Whether user account is approved (for admin applicants)
    isApproved: {
      type: Boolean,
      default: true, // Regular users are approved by default
    },

    // FIELD: Status of admin request
    adminRequestStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },

    // FIELD: When admin request was made
    adminRequestDate: {
      type: Date,
      default: null,
    },

    // FIELD: Whether to require OTP verification on every login
    // User can disable this in Settings for convenience (at slight security cost)
    // Registration OTP is always mandatory regardless of this setting
    otpEnabled: {
      type: Boolean,
      default: true,
    },
  },
  // Add automatic timestamps
  // createdAt: When user was created
  // updatedAt: When user was last modified
  { timestamps: true },
);

// Create and export User model
// MongoDB will create a "users" collection (plural of "User")
module.exports = mongoose.model("User", userSchema);
