// ============================================
// USER CONTROLLER - Handles user registration and retrieval
// ============================================

// Import User model (database schema)
const User = require("../models/User.model");
const AdminRequest = require("../models/AdminRequest.model");
const { sendOtp, verifyOtp } = require("../services/otp.service");

/**
 * FUNCTION: Send OTP for registration (Step 1 of 2)
 * Purpose: Validate registration data, then send OTP to user's email
 * Route: POST /api/users/register
 * The user account is NOT created yet — only created after OTP is verified
 */
exports.registerUser = async (req, res) => {
  const { name, email, password, role, requestAdmin } = req.body;

  // Validation: Check if all required fields are provided
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "name, email, and password are required",
    });
  }

  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase().trim();

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address",
    });
  }

  // Check if user with this email already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User with this email already exists",
    });
  }

  try {
    // For admin requests: check for existing pending request
    if (requestAdmin === true || role === "admin") {
      const existingRequest = await AdminRequest.findOne({
        email: normalizedEmail,
        status: "pending",
      });
      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message:
            "An admin request is already pending for this email. Please wait for approval.",
          isAlreadyRequested: true,
        });
      }
    }

    // Store registration data temporarily and send OTP
    await sendOtp(normalizedEmail, "register", {
      name: name.trim(),
      email: normalizedEmail,
      password,
      requestAdmin: requestAdmin === true || role === "admin",
    });

    // ✅ OTP sent — frontend will now show OTP input screen
    return res.status(200).json({
      success: true,
      message:
        "OTP sent to your email. Please verify to complete registration.",
      requiresOtp: true,
      email: normalizedEmail,
    });
  } catch (error) {
    // If OTP was already sent recently, redirect to OTP screen with the existing OTP
    if (error.code === "RATE_LIMITED") {
      return res.status(200).json({
        success: true,
        message:
          "An OTP was already sent to your email. Please check your inbox.",
        requiresOtp: true,
        email: normalizedEmail,
        alreadySent: true,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error sending OTP. Please try again.",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Verify OTP and complete registration (Step 2 of 2)
 * Purpose: Verify the OTP, then actually create the user account
 * Route: POST /api/users/verify-register-otp
 */
exports.verifyRegisterOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Verify the OTP (this also returns tempData stored during Step 1)
    const result = await verifyOtp(normalizedEmail, otp, "register");

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    // OTP verified — now create the account using stored temp data
    const { name, password, requestAdmin } = result.tempData;

    if (requestAdmin) {
      // Create admin request (same as before)
      const adminRequest = await AdminRequest.create({
        name,
        email: normalizedEmail,
        password,
        status: "pending",
        createdAt: new Date(),
      });

      return res.status(201).json({
        success: true,
        message:
          "Email verified! Admin request submitted. Your account will be created once approved by a super admin.",
        data: {
          _id: adminRequest._id,
          name: adminRequest.name,
          email: adminRequest.email,
          status: "pending",
        },
        isAdminRequest: true,
      });
    }

    // Regular user — create account now
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: "user",
      isApproved: true,
    });

    return res.status(201).json({
      success: true,
      message: "Email verified! Account created successfully!",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      isAdminRequest: false,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Get user by ID
 * Purpose: Retrieve a specific user's information from database
 * Route: GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  // Extract user ID from URL parameter
  // Example: GET /api/users/697b3d133a8ba6d8547a4bac → id = "697b3d133a8ba6d8547a4bac"
  const { id } = req.params;

  try {
    // ✅ FETCH USER: Search database by ID
    // .select("-password") means: "Return everything EXCEPT password field"
    const user = await User.findById(id).select("-password");

    // ❌ IF NOT FOUND: User doesn't exist in database
    if (!user) {
      return res.status(404).json({
        // status: 404 means "Not Found"
        success: false,
        message: "User not found",
      });
    }

    // ✅ SEND SUCCESS RESPONSE with user data
    res.status(200).json({
      // status: 200 means "OK" - request successful
      success: true,
      data: user,
    });
  } catch (error) {
    // ❌ ERROR HANDLING: If database query fails
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Login user (Step 1 of 2 — validate credentials and send OTP)
 * Purpose: Verify email + password, then send OTP to user's email
 * Route: POST /api/users/login
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // If user has disabled OTP for login, skip OTP step and return user directly
    if (user.otpEnabled === false) {
      return res.status(200).json({
        success: true,
        message: "Login successful!",
        requiresOtp: false,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          otpEnabled: user.otpEnabled,
        },
      });
    }

    // Credentials are correct — send OTP to email
    try {
      await sendOtp(normalizedEmail, "login");
    } catch (otpError) {
      if (otpError.code === "RATE_LIMITED") {
        // OTP already sent recently — tell frontend to show OTP screen with existing OTP
        return res.status(200).json({
          success: true,
          message:
            "An OTP was already sent to your email. Please check your inbox.",
          requiresOtp: true,
          email: normalizedEmail,
          alreadySent: true,
        });
      }
      throw otpError;
    }

    // ✅ Return OTP-required response (frontend will show OTP screen)
    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify to complete login.",
      requiresOtp: true,
      email: normalizedEmail,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Verify OTP and complete login (Step 2 of 2)
 * Purpose: Verify the OTP, then return user data to log them in
 * Route: POST /api/users/verify-login-otp
 */
exports.verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await verifyOtp(normalizedEmail, otp, "login");

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    // OTP verified — fetch user and return their data
    const user = await User.findOne({ email: normalizedEmail }).select(
      "-password",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Resend OTP
 * Purpose: Allow user to request a new OTP if they didn't receive one
 * Route: POST /api/users/resend-otp
 */
exports.resendOtp = async (req, res) => {
  const { email, purpose } = req.body;

  if (!email || !purpose) {
    return res.status(400).json({
      success: false,
      message: "Email and purpose are required",
    });
  }

  if (!["register", "login"].includes(purpose)) {
    return res.status(400).json({
      success: false,
      message: "Purpose must be 'register' or 'login'",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const Otp = require("../models/Otp.model");
    const existingOtp = await Otp.findOne({ email: normalizedEmail, purpose });
    const tempData = existingOtp?.tempData || null;

    if (purpose === "register" && !tempData) {
      return res.status(400).json({
        success: false,
        message: "Registration session expired. Please fill the form again.",
      });
    }

    if (purpose === "login") {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email",
        });
      }
    }

    await sendOtp(normalizedEmail, purpose, tempData);

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    if (error.code === "RATE_LIMITED") {
      return res.status(429).json({
        success: false,
        message: error.message,
        secondsLeft: error.secondsLeft,
        isRateLimited: true,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error resending OTP",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Update OTP preference for login
 * Purpose: User can enable/disable OTP verification on every login
 * Route: PUT /api/users/:id/otp-preference
 */
exports.updateOtpPreference = async (req, res) => {
  const { id } = req.params;
  const { otpEnabled } = req.body;

  if (typeof otpEnabled !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "otpEnabled must be true or false",
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { otpEnabled },
      { new: true },
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: `OTP login verification ${otpEnabled ? "enabled" : "disabled"} successfully`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        otpEnabled: user.otpEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating OTP preference",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Get all pending admin requests
 * Purpose: Super admin views requests to become admin
 * Route: GET /api/users/admin-requests/pending
 * IDEMPOTENCY: Only returns LATEST request per email (deduplicates)
 */
exports.getAdminRequests = async (req, res) => {
  try {
    // Get all pending requests, sorted by creation date (newest first)
    const allRequests = await AdminRequest.find({ status: "pending" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // DEDUPLICATION: Keep only the latest request per email
    const seenEmails = new Set();
    const uniqueRequests = allRequests.filter((request) => {
      if (seenEmails.has(request.email)) {
        return false; // Skip duplicate emails
      }
      seenEmails.add(request.email);
      return true; // Keep first (latest) occurrence
    });

    res.status(200).json({
      success: true,
      data: uniqueRequests,
      count: uniqueRequests.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin requests",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Approve admin request
 * Purpose: Super admin approves a user's request to become admin
 * Route: POST /api/users/admin-requests/:requestId/approve
 */
exports.approveAdminRequest = async (req, res) => {
  const { requestId } = req.params;
  const { superAdminId } = req.body;

  try {
    // Find the admin request
    const adminRequest = await AdminRequest.findById(requestId);
    if (!adminRequest) {
      return res.status(404).json({
        success: false,
        message: "Admin request not found",
      });
    }

    // Create user account now that request is approved
    const newUser = await User.create({
      name: adminRequest.name,
      email: adminRequest.email,
      password: adminRequest.password, // Use stored password
      role: "admin", // Approve as admin directly
      isApproved: true, // Account is now approved
      adminRequestStatus: "approved",
      adminRequestDate: new Date(),
    });

    // Update admin request with user ID and approval details
    adminRequest.user = newUser._id; // Link to created user
    adminRequest.status = "approved";
    adminRequest.approvedBy = superAdminId;
    adminRequest.approvalDate = new Date();
    await adminRequest.save();

    res.status(200).json({
      success: true,
      message: "Admin request approved and account created successfully",
      data: {
        request: adminRequest,
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error approving admin request",
      error: error.message,
    });
  }
};

/**
 * FUNCTION: Reject admin request
 * Purpose: Super admin rejects a user's request to become admin
 * Route: POST /api/users/admin-requests/:requestId/reject
 */
exports.rejectAdminRequest = async (req, res) => {
  const { requestId } = req.params;
  const { superAdminId, rejectionReason } = req.body;

  try {
    // Find the admin request
    const adminRequest = await AdminRequest.findById(requestId);
    if (!adminRequest) {
      return res.status(404).json({
        success: false,
        message: "Admin request not found",
      });
    }

    // Update admin request status
    adminRequest.status = "rejected";
    adminRequest.approvedBy = superAdminId;
    adminRequest.rejectionReason = rejectionReason || "No reason provided";
    adminRequest.approvalDate = new Date();
    await adminRequest.save();

    res.status(200).json({
      success: true,
      message: "Admin request rejected successfully",
      data: adminRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error rejecting admin request",
      error: error.message,
    });
  }
};
