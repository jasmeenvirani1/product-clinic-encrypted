import axios from "axios";
import { APP_CONFIG } from "@/constants/config";

const api = axios.create({
  baseURL: `${APP_CONFIG.apiUrl}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(APP_CONFIG.tokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403) {
      const code = error.response?.data?.code;
      if (code === "PLAN_EXPIRED" || code === "TRIAL_EXPIRED") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("plan-expired"));
        }
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${APP_CONFIG.apiUrl}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        localStorage.setItem(APP_CONFIG.tokenKey, data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem(APP_CONFIG.tokenKey);
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
