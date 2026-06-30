import axios from 'axios';
import { isOnline, queueMutation } from '../utils/offlineQueue';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(originalRequest?.method?.toLowerCase());
    const isNetworkError = !error.response && error.code === 'ERR_NETWORK';
    const isOffline = !isOnline();

    if (isMutation && (isOffline || isNetworkError)) {
      const url = originalRequest.url || originalRequest.baseURL;
      const method = originalRequest.method?.toUpperCase() || 'POST';
      const data = originalRequest.data ? JSON.parse(originalRequest.data) : null;

      if (data && url) {
        try {
          await queueMutation({ url, method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE', data });
          return Promise.resolve({
            data: { _offline: true, _queued: true },
            status: 202,
            statusText: 'Queued offline',
            headers: {},
            config: originalRequest,
          });
        } catch {
          // Queue failed, propagate original error
        }
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('displayName');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);