import { api } from "../utils/API";
import type { SuperAdminDashboardData, TenantDashboardData } from "../utils/types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const dashboardService = {
  async getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
    const { data } = await api.get<ApiResponse<SuperAdminDashboardData>>("/super-admin/dashboard");
    return data.data;
  },

  async getTenantDashboard(): Promise<TenantDashboardData> {
    const { data } = await api.get<ApiResponse<TenantDashboardData>>("/tenant/dashboard");
    return data.data;
  },
};
