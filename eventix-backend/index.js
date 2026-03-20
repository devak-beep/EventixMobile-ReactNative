require("dotenv").config();

let app = null;

module.exports = async (req, res) => {
  console.log(`[VERCEL] ${req.method} ${req.url}`);

  try {
    // Lazy-load app on first request
    if (!app) {
      console.log("[VERCEL] Loading app...");
      app = require("./src/app");
      console.log("[VERCEL] App loaded");
    }

    // Let Express app handle the request (app.js middleware handles DB connection)
    return app(req, res);
  } catch (error) {
    console.error("[VERCEL] Error:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Server error",
        message: error.message,
      });
    }
  }
};
