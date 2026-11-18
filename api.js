import axios from 'axios';
import { useAuth } from '../store/auth.js';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null; // one refresh at a time; parallel 401s wait for the same promise
api.interceptors.response.use((r) => r, async (error) => {
  const original = error.config;
  if (error.response?.status === 401 && !original._retried && !original.url.startsWith('/auth/')) {
    original._retried = true;
    refreshing ||= useAuth.getState().refresh().finally(() => { refreshing = null; });
    const ok = await refreshing;
    if (ok) return api(original);
  }
  return Promise.reject(error);
});

export const errMsg = (e) => e?.response?.data?.error || (e?.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Network problem. Check your connection and retry.');
export const errCode = (e) => e?.response?.data?.code;
export default api;
