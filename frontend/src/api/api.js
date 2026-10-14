import axios from 'axios';

const isLocalhost =
  typeof window !== 'undefined' &&
  (!window.location.hostname ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost
    ? 'http://172.18.100.55:8000'
    : `http://${window.location.hostname}:8000`);

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
