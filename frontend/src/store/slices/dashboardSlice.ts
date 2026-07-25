import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { dashboardService } from "../../services/dashboard.service";
import type { SuperAdminDashboardData, TenantDashboardData } from "../../utils/types";

interface DashboardState {
  superAdmin: SuperAdminDashboardData | null;
  tenant: TenantDashboardData | null;
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: DashboardState = {
  superAdmin: null,
  tenant: null,
  status: "idle",
};

export const fetchSuperAdminDashboard = createAsyncThunk("dashboard/super", dashboardService.getSuperAdminDashboard);
export const fetchTenantDashboard = createAsyncThunk("dashboard/tenant", dashboardService.getTenantDashboard);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuperAdminDashboard.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchSuperAdminDashboard.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.superAdmin = action.payload;
      })
      .addCase(fetchTenantDashboard.fulfilled, (state, action) => {
        state.tenant = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
