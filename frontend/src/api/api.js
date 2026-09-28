import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://172.18.7.91:8005";

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
