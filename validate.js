const { badRequest } = require('./errors');
module.exports = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(badRequest(r.error.issues.map((i) => i.message).join('; '), 'VALIDATION'));
  req.body = r.data; next();
};
