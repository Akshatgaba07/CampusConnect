const http = require('http');
const env = require('./config/env');
const app = require('./app');
const prisma = require('./config/db');
const redis = require('./config/redis');
const { initSocket } = require('./config/socket');
const { startJobs } = require('./jobs');

const server = http.createServer(app);
initSocket(server);
server.listen(env.port, () => { console.log(`[api] listening on :${env.port}`); startJobs(); });

const shutdown = async () => { server.close(); await prisma.$disconnect(); redis.disconnect(); process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
