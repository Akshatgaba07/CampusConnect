const prisma = require('../config/db');
module.exports = async function audit(req, action, entityType, entityId, metadata) {
  try {
    await prisma.auditLog.create({ data: { actorId: req.user?.sub || null, action, entityType, entityId: entityId ? String(entityId) : null, metadata: metadata || undefined, ip: req.ip } });
  } catch (e) { console.error('[audit]', e.message); }
};
