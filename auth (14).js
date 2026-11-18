import { create } from 'zustand';
import axios from 'axios';

const KEY = 'cc_refresh';
export const useAuth = create((set, get) => ({
  user: null, accessToken: null, ready: false,
  setSession: ({ accessToken, refreshToken, user }) => { localStorage.setItem(KEY, refreshToken); set({ accessToken, user }); },
  // Called once at startup and by the axios interceptor. Uses bare axios so it can't recurse into the interceptor.
  refresh: async () => {
    const refreshToken = localStorage.getItem(KEY);
    if (!refreshToken) return false;
    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      get().setSession(data); return true;
    } catch { localStorage.removeItem(KEY); set({ user: null, accessToken: null }); return false; }
  },
  boot: async () => { await get().refresh(); set({ ready: true }); },
  logout: async () => {
    const refreshToken = localStorage.getItem(KEY);
    if (refreshToken) axios.post('/api/auth/logout', { refreshToken }).catch(() => {});
    localStorage.removeItem(KEY); set({ user: null, accessToken: null });
  },
}));
