import axios from 'axios';
import { clearAuthSession, getStoredToken } from '../utils/authStorage';

const API_BASE = '/api';
const AUTH_FREE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/logout',
  '/auth/google',
  '/health',
];

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestPath = error?.config?.url || '';
    const shouldBypassAuthReset = AUTH_FREE_PATHS.some((path) => requestPath.includes(path));

    if (status === 401 && !shouldBypassAuthReset && getStoredToken()) {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    return Promise.reject(error);
  },
);

export const optimizeRoute = (data) => api.post('/routes/optimize', data);
export const refreshRoute = (data) => api.post('/routes/refresh', data);
export const optimizeMultiStop = (data) => api.post('/routes/multi-stop', data);

export const getTrafficZones = (sourceLat, sourceLon, destLat, destLon, refresh = false) =>
  api.get(
    `/routes/traffic-zones?sourceLat=${sourceLat}&sourceLon=${sourceLon}&destLat=${destLat}&destLon=${destLon}&refresh=${refresh}`,
  );

export const geocodePlace = (query, lat, lon) => {
  let url = `/routes/geocode?q=${encodeURIComponent(query)}`;
  if (lat && lon) url += `&lat=${lat}&lon=${lon}`;
  return api.get(url);
};

export const reverseGeocode = (lat, lon) => api.get(`/routes/reverse-geocode?lat=${lat}&lon=${lon}`);

export const getHistory = () => api.get('/history');
export const saveHistory = (data) => api.post('/history', data);
export const deleteHistory = (id) => api.delete(`/history/${id}`);
export const getStats = () => api.get('/history/stats');

export const healthCheck = () => api.get('/health');

export const aiSearch = (query, location = null) => api.post('/search', { query, location });
export const getNearbyImages = (lat, lon, limit = 6) =>
  api.get(`/images?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=${encodeURIComponent(limit)}`);
export const getRouteImages = (coordinates = [], limit = 6) => api.post('/images/route', { coordinates, limit });
export const aiChat = (message, context = {}) => api.post('/chat', { message, context });
export const aiAnalyze = (context) => api.post('/ai/analyze', context);
export const aiNavigationEvent = (eventData) => api.post('/ai/navigation-event', eventData);
export const testGemini = () => api.post('/ai/test');
export const saveAIMessage = (message) => api.post('/ai/save-message', message);
export const getAIHistory = () => api.get('/ai/get-history');

export const getTraffic = (params = {}) => api.get('/traffic', { params });
export const saveTrafficPoints = (data) => api.post('/traffic', data);

export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const loginWithGoogleRequest = (idToken) => api.post('/auth/google', { idToken });
export const verifyEmailToken = (token) => api.post('/auth/verify-email', { token });
export const resendVerification = (email) => api.post('/auth/resend-verification', { email });
export const getCurrentUser = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const logoutUser = () => api.post('/auth/logout');

export const getSavedPlaces = () => api.get('/saved');
export const getSavedPlace = (id) => api.get(`/saved/${id}`);
export const addSavedPlace = (data) => api.post('/saved', data);
export const updateSavedPlace = (id, data) => api.put(`/saved/${id}`, data);
export const deleteSavedPlace = (id) => api.delete(`/saved/${id}`);

export default api;
