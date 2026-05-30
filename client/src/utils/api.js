import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('smartcut_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const authPaths = [
        '/customer/login', '/customer/register',
        '/barbershop/login', '/barbershop/register',
        '/barber/login', '/admin-login'
      ];
      const isOnAuthPage = authPaths.some(p => window.location.pathname.startsWith(p));
      if (!isOnAuthPage) {
        localStorage.removeItem('smartcut_token');
        localStorage.removeItem('smartcut_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
