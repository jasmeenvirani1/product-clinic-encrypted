import { api } from "@/utils/API";

export interface WonLead {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  booked_at: string;
  latest_conversation_id: number | null;
  conversations: { id: number; channel: string; status: string }[];
  // super admin only
  clinic_name?: string;
  tenant_id?: number | null;
}

export interface GeneratedInvoice {
  id: number;
  invoice_number: string;
  lead_id: number;
  tenant_id: number;
  generated_by: number;
  amount: string;
  currency: string;
  status: "draft" | "sent" | "paid";
  notes: string | null;
  createdAt: string;
  Lead?: { id: number; name: string; phone: string | null };
  Tenant?: { id: number; full_name: string; clinic_name: string | null; email: string };
  GeneratedBy?: { id: number; full_name: string };
}

export interface GenerateInvoicePayload {
  amount: number;
  currency?: string;
  notes?: string;
}

export const wonLeadsService = {
  getWonLeads: () =>
    api.get<{ success: boolean; data: WonLead[] }>("/won-leads"),

  getInvoices: () =>
    api.get<{ success: boolean; data: GeneratedInvoice[] }>("/won-leads/invoices"),

  generateInvoice: (leadId: number, payload: GenerateInvoicePayload) =>
    api.post<{ success: boolean; data: GeneratedInvoice }>(`/won-leads/${leadId}/invoice`, payload),
};
