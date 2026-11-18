const prisma = require('../config/db');
const redis = require('../config/redis');
const { getProducer } = require('../config/kafka');
const { expireHolds } = require('../services/bookingService');

// Only one backend replica should run a job tick: SET NX with a short TTL is a tiny leader lock.
const leader = async (name, ttlSec) => (await redis.set(`job:${name}`, process.pid.toString(), 'EX', ttlSec, 'NX')) === 'OK';

// Transactional outbox relay: rows written in the same DB transaction as the booking are pushed to Kafka here,
// so a Kafka outage can never lose a notification and never makes a booking fail.
async function relayOutbox() {
  const rows = await prisma.$queryRaw`SELECT id, topic, key, payload FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 50`;
  if (!rows.length) return;
  const producer = await getProducer();
  for (const r of rows) {
    try {
      await producer.send({ topic: r.topic, messages: [{ key: r.key, value: JSON.stringify({ outboxId: r.id, ...r.payload }) }] });
      await prisma.outboxEvent.update({ where: { id: r.id }, data: { publishedAt: new Date() } });
    } catch (e) { await prisma.outboxEvent.update({ where: { id: r.id }, data: { attempts: { increment: 1 } } }); console.error('[outbox]', e.message); break; }
  }
}

async function housekeeping() {
  const now = new Date();
  await prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now - 86_400_000) } } });
  await prisma.verifiedRegistrationChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now - 86_400_000) } } });
  await prisma.userSession.deleteMany({ where: { expiresAt: { lt: now } } });
}

function startJobs() {
  setInterval(async () => { if (await leader('expire', 8)) expireHolds().catch((e) => console.error('[job:expire]', e.message)); }, 10_000);
  setInterval(async () => { if (await leader('outbox', 2)) relayOutbox().catch((e) => console.error('[job:outbox]', e.message)); }, 3_000);
  setInterval(async () => { if (await leader('housekeeping', 3000)) housekeeping().catch(() => {}); }, 3_600_000);
}
module.exports = { startJobs };
