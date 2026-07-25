export interface Lead {
  id: string;
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
  custom_data?: Record<string, unknown> | null;
  AssignedUser?: { id: number; full_name: string; email: string } | null;
  CreatedByUser?: { id: number; full_name: string } | null;
}

export interface CreateLeadPayload {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  stage?: Lead["stage"];
  city?: string;
  score?: number;
  notes?: string;
  remark?: string;
  last_message?: string;
  assigned_to?: number | null;
  custom_data?: Record<string, unknown>;
}

export interface UpdateLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  stage?: Lead["stage"];
  city?: string;
  score?: number;
  notes?: string;
  remark?: string;
  last_message?: string;
  assigned_to?: number | null;
  is_active?: boolean;
  custom_data?: Record<string, unknown>;
}
