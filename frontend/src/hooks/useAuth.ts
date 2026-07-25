"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import { authService } from "@/services/auth.service";
import { APP_CONFIG } from "@/constants/config";
import { ROUTES } from "@/constants/routes";
import type { LoginPayload } from "@/types/auth.types";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, clearAuth } = useStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await authService.login(payload);
      localStorage.setItem(APP_CONFIG.tokenKey, response.token);
      setUser(response.user);
      router.push(response.redirectTo);
      return response;
    },
    [setUser, router]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem(APP_CONFIG.tokenKey);
      clearAuth();
      router.push(ROUTES.LOGIN);
    }
  }, [clearAuth, router]);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem(APP_CONFIG.tokenKey);
      if (!token) return false;
      const response = await authService.getMe();
      setUser(response.user);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, [setUser, clearAuth]);

  return { user, isAuthenticated, login, logout, checkAuth };
}
