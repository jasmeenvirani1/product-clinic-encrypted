import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { tenantService } from "../../services/tenant.service";
import type { Campaign, IntegrationKey, TeamMember, Tenant } from "../../utils/types";

interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  campaigns: Campaign[];
  teamMembers: TeamMember[];
  integrations: IntegrationKey[];
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: TenantState = {
  currentTenant: null,
  tenants: [],
  campaigns: [],
  teamMembers: [],
  integrations: [],
  status: "idle",
};

export const fetchCurrentTenant = createAsyncThunk("tenant/current", tenantService.getCurrentTenant);
export const fetchTenants = createAsyncThunk("tenant/all", tenantService.getTenants);
export const fetchCampaigns = createAsyncThunk("tenant/campaigns", tenantService.getCampaigns);
export const fetchTeamMembers = createAsyncThunk("tenant/team", tenantService.getTeamMembers);
export const fetchTenantIntegrations = createAsyncThunk("tenant/integrations", tenantService.getIntegrations);

const tenantSlice = createSlice({
  name: "tenant",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentTenant.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchCurrentTenant.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentTenant = action.payload;
      })
      .addCase(fetchTenants.fulfilled, (state, action) => {
        state.tenants = action.payload;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.campaigns = action.payload;
      })
      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.teamMembers = action.payload;
      })
      .addCase(fetchTenantIntegrations.fulfilled, (state, action) => {
        state.integrations = action.payload;
      });
  },
});

export default tenantSlice.reducer;
