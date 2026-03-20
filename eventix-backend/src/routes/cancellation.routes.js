const express = require("express");
const { cancelBooking } = require("../controllers/cancellation.controller");

const router = express.Router();

// Cancel a confirmed booking
router.post("/:bookingId/cancel", cancelBooking);

module.exports = router;
