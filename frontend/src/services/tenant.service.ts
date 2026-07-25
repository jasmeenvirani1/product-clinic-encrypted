import { clone, sleep } from "./helpers";
import { mockCampaigns, mockIntegrationKeys, mockTeamMembers, mockTenants } from "./mockData";

export const tenantService = {
  async getCurrentTenant() {
    await sleep(600);
    return clone(mockTenants[0]);
  },

  async getTenants() {
    await sleep(700);
    return clone(mockTenants);
  },

  async getCampaigns() {
    await sleep(650);
    return clone(mockCampaigns);
  },

  async getTeamMembers() {
    await sleep(650);
    return clone(mockTeamMembers);
  },

  async getIntegrations() {
    await sleep(650);
    return clone(mockIntegrationKeys);
  },
};
