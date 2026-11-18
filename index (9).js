const { Kafka, logLevel } = require('kafkajs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const { render } = require('./templates');

const TOPIC = 'notifications', DLQ = 'notifications.dlq';
const kafka = new Kafka({ clientId: 'campusconnect-notification-worker', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','), logLevel: logLevel.WARN, retry: { retries: 10 } });
const pool = new Pool({ connectionString: (process.env.DATABASE_URL || '').split('?')[0], max: 4 });
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-mail.outlook.com', port: Number(process.env.SMTP_PORT || 587), secure: false, requireTLS: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, tls: { minVersion: 'TLSv1.2' },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendOne(msg) {
  const build = render[msg.type];
  if (!build) throw new Error(`Unknown notification type ${msg.type}`);
  // Idempotency: Kafka is at-least-once, so skip anything already delivered.
  const { rows } = await pool.query('SELECT status FROM notifications WHERE id = $1::uuid', [msg.notificationId]);
  if (rows[0]?.status === 'SENT') return;
  const { subject, html } = build(msg);
  const attachments = msg.type === 'BOOKING_CONFIRMED'
    ? await Promise.all(msg.tickets.map(async (t, i) => ({ filename: `ticket-${t.seat}.png`, cid: `qr${i}`, content: await QRCode.toBuffer(t.qr, { width: 280, margin: 1, errorCorrectionLevel: 'M' }) })))
    : [];
  await transporter.sendMail({ from: `CampusConnect <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to: msg.to, subject, html, attachments });
  await pool.query("UPDATE notifications SET status = 'SENT', sent_at = (now() AT TIME ZONE 'utc'), error = NULL WHERE id = $1::uuid", [msg.notificationId]);
}

async function main() {
  const admin = kafka.admin(); await admin.connect();
  await admin.createTopics({ waitForLeaders: true, topics: [{ topic: TOPIC, numPartitions: 3 }, { topic: DLQ, numPartitions: 1 }] });
  await admin.disconnect();

  const producer = kafka.producer(); await producer.connect();
  const consumer = kafka.consumer({ groupId: 'notification-workers' });
  await consumer.connect(); await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const msg = JSON.parse(message.value.toString());
      for (let attempt = 1; attempt <= 4; attempt++) {
        try { await sendOne(msg); console.log(`[worker] sent ${msg.type} -> ${msg.to}`); return; }
        catch (e) {
          console.error(`[worker] attempt ${attempt} failed: ${e.message}`);
          if (attempt === 4) { // park it so one bad message can never block the partition
            await pool.query("UPDATE notifications SET status = 'FAILED', error = $2 WHERE id = $1::uuid", [msg.notificationId, String(e.message).slice(0, 500)]).catch(() => {});
            await producer.send({ topic: DLQ, messages: [{ key: message.key, value: message.value }] });
          } else await sleep(2000 * attempt);
        }
      }
    },
  });
  const stop = async () => { await consumer.disconnect(); await producer.disconnect(); await pool.end(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch((e) => { console.error('[worker] fatal', e); process.exit(1); });
