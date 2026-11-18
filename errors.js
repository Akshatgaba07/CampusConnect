class AppError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
module.exports = { AppError, badRequest: (m, c) => new AppError(400, m, c), unauthorized: (m = 'Unauthorized') => new AppError(401, m),
  forbidden: (m = 'Forbidden') => new AppError(403, m), notFound: (m = 'Not found') => new AppError(404, m), conflict: (m, c) => new AppError(409, m, c),
  tooMany: (m) => new AppError(429, m) };
