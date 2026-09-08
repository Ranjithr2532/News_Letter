import axios from 'axios';

const hostname = window.location.hostname || 'localhost';

const api = axios.create({
  baseURL: `http://${hostname}:8000`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
