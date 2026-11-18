const Redis = require('ioredis');
const env = require('./env');
const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 3 });
redis.on('error', (e) => console.error('[redis]', e.message));
module.exports = redis;
