// ============================================
// USER ROUTES - API endpoints for user operations
// ============================================

// Import Express router library
const express = require("express");
// Create a router instance to define routes
const router = express.Router();

// Import controller functions that handle requests
const {
  registerUser,
  loginUser,
  getUserById,
  getAdminRequests,
  approveAdminRequest,
  rejectAdminRequest,
  verifyRegisterOtp,
  verifyLoginOtp,
  resendOtp,
  updateOtpPreference,
} = require("../controllers/user.controller");

// Import middleware for superAdmin routes
const { requireSuperAdmin } = require("../middlewares/auth.middleware");

// ROUTE 1: POST /api/users/register
// Purpose: Validate registration data and send OTP to email (Step 1 of 2)
// Handler: registerUser function
// Request body: {name, email, password, role}
// Response: {success: true, requiresOtp: true, email}
router.post("/register", registerUser);

// ROUTE 2: POST /api/users/verify-register-otp
// Purpose: Verify OTP and create user account (Step 2 of 2)
// Handler: verifyRegisterOtp function
// Request body: {email, otp}
// Response: {success: true, data: {_id, name, email, role}}
router.post("/verify-register-otp", verifyRegisterOtp);

// ROUTE 3: POST /api/users/login
// Purpose: Validate credentials and send OTP to email (Step 1 of 2)
// Handler: loginUser function
// Request body: {email, password}
// Response: {success: true, requiresOtp: true, email}
router.post("/login", loginUser);

// ROUTE 4: POST /api/users/verify-login-otp
// Purpose: Verify OTP and complete login (Step 2 of 2)
// Handler: verifyLoginOtp function
// Request body: {email, otp}
// Response: {success: true, data: user}
router.post("/verify-login-otp", verifyLoginOtp);

// ROUTE 5: POST /api/users/resend-otp
// Purpose: Resend OTP if user didn't receive it
// Handler: resendOtp function
// Request body: {email, purpose} (purpose = "register" or "login")
// Response: {success: true, message}
router.post("/resend-otp", resendOtp);

// ROUTE 6: PUT /api/users/:id/otp-preference
// Purpose: Enable or disable OTP verification on login
// Handler: updateOtpPreference function
// Request body: {otpEnabled: true/false}
// Response: {success: true, data: updatedUser}
router.put("/:id/otp-preference", updateOtpPreference);

// ROUTE 7: GET /api/users/:id
// Purpose: Get user information by ID
// Handler: getUserById function
// URL parameter: id (user's MongoDB ID)
// Response: {success: true, data: user}
router.get("/:id", getUserById);

// ROUTE 4: GET /api/users/admin-requests/pending
// Purpose: Get all pending admin requests (super admin only)
// Handler: getAdminRequests function
// Middleware: requireSuperAdmin - protects route from non-superAdmin users
// Response: {success: true, data: [requests]}
router.get("/admin-requests/pending", requireSuperAdmin, getAdminRequests);

// ROUTE 5: POST /api/users/admin-requests/:requestId/approve
// Purpose: Approve an admin request (super admin only)
// Handler: approveAdminRequest function
// Middleware: requireSuperAdmin - protects route from non-superAdmin users
// Request body: {rejectionReason (optional)}
// Response: {success: true, data: updatedRequest}
router.post(
  "/admin-requests/:requestId/approve",
  requireSuperAdmin,
  approveAdminRequest,
);

// ROUTE 6: POST /api/users/admin-requests/:requestId/reject
// Purpose: Reject an admin request (super admin only)
// Handler: rejectAdminRequest function
// Middleware: requireSuperAdmin - protects route from non-superAdmin users
// Request body: {rejectionReason}
// Response: {success: true, data: rejectedRequest}
router.post(
  "/admin-requests/:requestId/reject",
  requireSuperAdmin,
  rejectAdminRequest,
);

// Export router so app.js can use it
module.exports = router;
