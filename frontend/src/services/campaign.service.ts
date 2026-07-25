import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";

export interface BackendCampaign {
  id: number;
  name: string;
  offer_type: "discount" | "package" | "free_consultation" | "custom";
  offer_description: string | null;
  message_template: string | null;
  channel: string;
  whatsapp_template_name: string | null;
  whatsapp_template_language: string | null;
  audience: "all" | "new_leads" | "old_leads" | "inactive_leads" | "won_leads" | "lost_leads";
  audience_days: number;
  budget: string | null;
  status: "draft" | "active" | "paused" | "completed";
  total_recipients: number;
  sent_count: number;
  sent_at: string | null;
  tenant_id: number | null;
  created_by: number | null;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
  CreatedByUser?: { id: number; full_name: string; email: string } | null;
}

export interface CreateCampaignPayload {
  name: string;
  channel: string;
  offer_type?: string;
  offer_description?: string;
  message_template?: string;
  audience?: string;
  audience_days?: number;
  budget?: string;
  status?: string;
  whatsapp_template_name?: string;
  whatsapp_template_language?: string;
  custom_data?: Record<string, unknown>;
}

export type UpdateCampaignPayload = Partial<CreateCampaignPayload>;

export interface AudiencePreview {
  total: number;
  leads: Array<{
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    stage: string;
    source: string | null;
    created_at: string;
  }>;
}

export const campaignService = {
  async getAll(): Promise<ApiResponse<BackendCampaign[]>> {
    const { data } = await api.get<ApiResponse<BackendCampaign[]>>("/campaigns");
    return data;
  },

  async create(payload: CreateCampaignPayload): Promise<ApiResponse<BackendCampaign>> {
    const { data } = await api.post<ApiResponse<BackendCampaign>>("/campaigns", payload);
    return data;
  },

  async update(id: number, payload: UpdateCampaignPayload): Promise<ApiResponse<BackendCampaign>> {
    const { data } = await api.put<ApiResponse<BackendCampaign>>(`/campaigns/${id}`, payload);
    return data;
  },

  async send(id: number): Promise<ApiResponse<{ total_recipients: number; contactable: number; sent_count: number; failed_count: number; channel: string }>> {
    const { data } = await api.post<ApiResponse<{ total_recipients: number; contactable: number; sent_count: number; failed_count: number; channel: string }>>(`/campaigns/${id}/send`);
    return data;
  },

  async previewAudience(audience: string, audienceDays: number): Promise<ApiResponse<AudiencePreview>> {
    const { data } = await api.get<ApiResponse<AudiencePreview>>(`/campaigns/preview-audience?audience=${audience}&audience_days=${audienceDays}`);
    return data;
  },

  async delete(id: number): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>(`/campaigns/${id}`);
    return data;
  },
};
