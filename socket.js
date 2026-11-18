const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const env = require('./env');
let io;
function initSocket(httpServer) {
  io = new Server(httpServer, { path: '/socket.io', cors: { origin: env.corsOrigin, credentials: true } });
  const pub = new Redis(env.redisUrl), sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub)); // lets several backend replicas broadcast to each other's clients
  io.use((socket, next) => {
    try { socket.user = jwt.verify(socket.handshake.auth?.token || '', env.jwtAccessSecret, { algorithms: ['HS256'] }); next(); }
    catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (socket) => {
    socket.on('slot:join', (slotId) => typeof slotId === 'string' && socket.join(`slot:${slotId}`));
    socket.on('slot:leave', (slotId) => socket.leave(`slot:${slotId}`));
  });
  return io;
}
const emitSeats = (slotId, seatIds, status) => io && io.to(`slot:${slotId}`).emit('seats:update', { slotId, seatIds, status });
module.exports = { initSocket, emitSeats };
