// ============================================
// ROLE CHECK MIDDLEWARE - Verify user role
// ============================================

/**
 * Middleware to check if user has admin role
 * Note: This is a simple check. In production, use JWT tokens for authentication.
 */
exports.requireAdmin = (req, res, next) => {
  const { userId, userRole } = req.body;

  // Check if role is provided
  if (!userRole) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Role information required.",
    });
  }

  // Check if user is admin or superAdmin (superAdmin has all admin privileges)
  if (userRole !== "admin" && userRole !== "superAdmin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }

  // User is admin or superAdmin, proceed to next middleware/controller
  next();
};

/**
 * Middleware to check if user has superAdmin role
 * Used to protect admin management routes
 * Gets user info from x-user-role and x-user-id headers (sent from frontend)
 */
exports.requireSuperAdmin = (req, res, next) => {
  try {
    // Get user info from custom headers (frontend sends these after login)
    const userRole = req.headers["x-user-role"];
    const userId = req.headers["x-user-id"];

    // Check if headers are present
    if (!userRole || !userId) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    // Check if user is superAdmin
    if (userRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. SuperAdmin privileges required.",
      });
    }

    // Attach user info to request for use in controller
    req.userId = userId;
    req.userRole = userRole;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication",
    });
  }
};
