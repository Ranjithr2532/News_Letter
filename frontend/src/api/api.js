import axios from 'axios';

const baseURL = 'http://172.18.100.55:8000';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { baseURL };
export default api;

