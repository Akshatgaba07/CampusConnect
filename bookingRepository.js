const prisma = require('../config/db');
const include = {
  slot: { include: { event: true } },
  seats: { include: { seat: true, ticket: true } },
};
module.exports = {
  mine: (userId) => prisma.booking.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include }),
  findForUser: (id, userId) => prisma.booking.findFirst({ where: { id, userId }, include }),
  findByIdempotency: (userId, key) => prisma.booking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } }, include }),
  include,
};
