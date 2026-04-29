import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Remove Content-Type from common defaults so Axios can auto-detect it per
// request: plain objects still get application/json via transformRequest,
// and FormData gets the correct multipart/form-data boundary from the browser.
delete (api.defaults.headers.common as Record<string, unknown>)['Content-Type'];

api.interceptors.request.use((config) => {
  const accessToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return Promise.reject(error);
    }

    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = api
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          '/auth/refresh',
          { refreshToken },
        )
        .then((res) => {
          const { accessToken, refreshToken: newRefresh } = res.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          return accessToken;
        })
        .catch((err) => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(err);
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  },
);

export default api;
