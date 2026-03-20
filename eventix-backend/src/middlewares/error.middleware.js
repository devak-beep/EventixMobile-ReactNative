const { logError } = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logError(err, {
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params
  }, req.correlationId);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    correlationId: req.correlationId
  });
};
