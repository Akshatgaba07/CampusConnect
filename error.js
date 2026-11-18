const { AppError } = require('../utils/errors');
module.exports = {
  notFound: (_req, res) => res.status(404).json({ error: 'Route not found' }),
  errorHandler: (err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  },
};
