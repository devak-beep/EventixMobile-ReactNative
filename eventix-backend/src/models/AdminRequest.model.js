// ============================================
// ADMIN REQUEST MODEL - For admin approval workflow
// ============================================

const mongoose = require("mongoose");

const adminRequestSchema = new mongoose.Schema(
  {
    // User who requested to become admin (null until approved)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // User details (stored at request time for account creation on approval)
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    // Password for new account (stored until approved, then deleted from database)
    password: {
      type: String,
      required: true,
    },

    // Status of the request
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Reason for rejection (if rejected)
    rejectionReason: {
      type: String,
      default: null,
    },

    // Super admin who approved/rejected
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // When was it approved/rejected
    approvalDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }, // createdAt and updatedAt
);

module.exports = mongoose.model("AdminRequest", adminRequestSchema);
