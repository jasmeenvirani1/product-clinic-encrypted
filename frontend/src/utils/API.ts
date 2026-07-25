import axios from "axios";

export const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const code = error.response?.data?.code;
      if (code === "PLAN_EXPIRED" || code === "TRIAL_EXPIRED") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("plan-expired"));
        }
      }
    }
    return Promise.reject(error);
  }
);

API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("crm_auth_session");
      if (raw) {
        const { token } = JSON.parse(raw) as { token?: string };
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore
    }
  }
  return config;
});

/** Convenience alias used by service files */
export const api = API as typeof API;

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  mobile: string | null;
  isActive: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  message?: string;
}

export interface OtpApiResponse {
  message: string;
  expiresAt?: string;
}

export interface BasicApiResponse {
  message: string;
}

export interface VerifyForgotOtpResponse {
  message: string;
  resetToken: string;
}

export const registerWithEmailPassword = async (data: { fullName: string; email: string; password: string }) => {
  const response = await API.post<AuthResponse>("/auth/register", data);
  return response.data;
};

export const sendRegisterOtp = async (data: { fullName: string; email: string; password: string }) => {
  const response = await API.post<OtpApiResponse>("/auth/register/email/send-otp", data);
  return response.data;
};

export const resendRegisterOtp = async (data: { email: string }) => {
  const response = await API.post<OtpApiResponse>("/auth/register/email/resend-otp", data);
  return response.data;
};

export const verifyRegisterOtp = async (data: { email: string; otp: string }) => {
  const response = await API.post<BasicApiResponse>("/auth/register/email/verify-otp", data);
  return response.data;
};

export const loginWithEmailPassword = async (data: { email: string; password: string }) => {
  const response = await API.post<AuthResponse>("/auth/login/email-password", data);
  return response.data;
};

export const sendForgotPasswordOtp = async (data: { email: string }) => {
  const response = await API.post<OtpApiResponse>("/auth/password/forgot/send-otp", data);
  return response.data;
};

export const resetPasswordWithOtp = async (data: { resetToken: string; newPassword: string }) => {
  const response = await API.post<BasicApiResponse>("/auth/password/forgot/reset", data);
  return response.data;
};

export const verifyForgotPasswordOtp = async (data: { email: string; otp: string }) => {
  const response = await API.post<VerifyForgotOtpResponse>("/auth/password/forgot/verify-otp", data);
  return response.data;
};
