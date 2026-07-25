import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";
import type { Lead, CreateLeadPayload, UpdateLeadPayload } from "@/types/lead.types";

interface BackendLeadResponse {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage: "new" | "qualified" | "discussion" | "won" | "lost";
  city: string | null;
  score: number;
  notes: string | null;
  remark: string | null;
  last_message: string | null;
  assigned_to: number | null;
  created_by: number | null;
  tenant_id: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  ai_summary: string | null;
  summary_updated_at: string | null;
  AssignedUser?: { id: number; full_name: string; email: string } | null;
  CreatedByUser?: { id: number; full_name: string } | null;
  custom_data?: Record<string, unknown> | null;
}

const mapBackendLead = (lead: BackendLeadResponse): Lead => ({
  id: String(lead.id),
  name: lead.name,
  phone: lead.phone,
  email: lead.email,
  source: lead.source,
  stage: lead.stage,
  city: lead.city,
  score: lead.score,
  notes: lead.notes,
  remark: lead.remark,
  last_message: lead.last_message,
  assigned_to: lead.assigned_to,
  created_by: lead.created_by,
  tenant_id: lead.tenant_id,
  is_active: lead.is_active,
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt,
  ai_summary: lead.ai_summary,
  summary_updated_at: lead.summary_updated_at,
  custom_data: lead.custom_data ?? null,
  AssignedUser: lead.AssignedUser,
  CreatedByUser: lead.CreatedByUser,
});

export const leadsService = {
  async getAll(tenantId?: number): Promise<ApiResponse<Lead[]>> {
    const params = tenantId != null ? { tenant_id: tenantId } : undefined;
    const { data } = await api.get<ApiResponse<BackendLeadResponse[]>>("/leads", { params });
    return { ...data, data: (data.data ?? []).map(mapBackendLead) };
  },

  async getById(id: string): Promise<ApiResponse<Lead>> {
    const { data } = await api.get<ApiResponse<BackendLeadResponse>>(`/leads/${id}`);
    return { ...data, data: mapBackendLead(data.data) };
  },

  async create(payload: CreateLeadPayload): Promise<ApiResponse<Lead>> {
    const { data } = await api.post<ApiResponse<BackendLeadResponse>>("/leads", payload);
    return { ...data, data: mapBackendLead(data.data) };
  },

  async update(id: string, payload: UpdateLeadPayload): Promise<ApiResponse<Lead>> {
    const { data } = await api.put<ApiResponse<BackendLeadResponse>>(`/leads/${id}`, payload);
    return { ...data, data: mapBackendLead(data.data) };
  },

  async delete(id: string): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>(`/leads/${id}`);
    return data;
  },

  async getTeammates(): Promise<{ id: number; full_name: string; email: string }[]> {
    const { data } = await api.get<ApiResponse<{ id: number; full_name: string; email: string }[]>>("/leads/teammates");
    return data.data ?? [];
  },

  async getSummaries(id: string): Promise<{ id: number; summary: string; stage: string; score: number; intent: string; createdAt: string }[]> {
    const { data } = await api.get<ApiResponse<{ id: number; summary: string; stage: string; score: number; intent: string; createdAt: string }[]>>(`/leads/${id}/summaries`);
    return data.data ?? [];
  },

  async regenerateSummary(id: string): Promise<ApiResponse<Lead>> {
    const { data } = await api.post<ApiResponse<BackendLeadResponse>>(`/leads/${id}/summary/regenerate`);
    return { ...data, data: mapBackendLead(data.data) };
  },

  // Legacy alias used by old leadsSlice thunks
  async getLeads(): Promise<Lead[]> {
    const response = await leadsService.getAll();
    return response.data ?? [];
  },

  async updateLeadStage(leadId: string, stage: string): Promise<Lead> {
    const response = await leadsService.update(leadId, { stage: stage as Lead["stage"] });
    return response.data;
  },
};
