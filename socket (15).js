import { io } from 'socket.io-client';
import { useAuth } from '../store/auth.js';
let socket;
export function getSocket() {
  if (!socket) socket = io('/', { path: '/socket.io', auth: (cb) => cb({ token: useAuth.getState().accessToken }), reconnectionDelayMax: 5000 });
  return socket;
}
