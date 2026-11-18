const { Kafka, logLevel } = require('kafkajs');
const env = require('./env');
const kafka = new Kafka({ clientId: 'campusconnect-backend', brokers: env.kafkaBrokers, logLevel: logLevel.WARN, retry: { retries: 8 } });
let producer;
async function getProducer() {
  if (!producer) { producer = kafka.producer({ idempotent: true }); await producer.connect(); }
  return producer;
}
module.exports = { kafka, getProducer };
