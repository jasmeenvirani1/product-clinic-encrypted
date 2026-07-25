import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";

export interface AISetting {
  id: number;
  tenant_id: number;
  ai_tone: "professional" | "warm" | "premium" | "friendly" | "formal";
  prompt_instructions: string;
  escalate_low_confidence: boolean;
  auto_handover_high_intent: boolean;
  high_intent_keywords: string[];
  medium_intent_keywords: string[];
  low_intent_keywords: string[];
  openai_api_key_masked: string | null;
  has_api_key: boolean;
  openai_model: string;
  openai_base_url: string | null;
  ai_responds_to_intents: string[];
  email_notify_intents: string[];
  notification_email: string | null;
  followup_1_enabled: boolean;
  followup_1_days: number;
  followup_2_enabled: boolean;
  followup_2_days: number;
}

export interface UpdateAISettingPayload {
  ai_tone?: string;
  prompt_instructions?: string;
  escalate_low_confidence?: boolean;
  auto_handover_high_intent?: boolean;
  high_intent_keywords?: string[];
  medium_intent_keywords?: string[];
  low_intent_keywords?: string[];
  openai_api_key?: string;
  openai_model?: string;
  openai_base_url?: string;
  ai_responds_to_intents?: string[];
  email_notify_intents?: string[];
  notification_email?: string;
  followup_1_enabled?: boolean;
  followup_1_days?: number;
  followup_2_enabled?: boolean;
  followup_2_days?: number;
}

export const aiSettingService = {
  async get(): Promise<AISetting> {
    const { data } = await api.get<ApiResponse<AISetting>>("/ai-settings");
    return data.data;
  },

  async update(payload: UpdateAISettingPayload): Promise<AISetting> {
    const { data } = await api.put<ApiResponse<AISetting>>("/ai-settings", payload);
    return data.data;
  },
};

// ─── WhatsApp-QR channel (Baileys — link the clinic's real WhatsApp by QR) ───
export type WhatsAppQrStatus =
  | "unlinked"
  | "connecting"
  | "qr_pending"
  | "connected"
  | "disconnected"
  | "logged_out";

export interface WhatsAppQrState {
  success: boolean;
  status: WhatsAppQrStatus;
  number?: string | null;
  qr?: string | null; // data:image/png;base64,... ready for <img src>
}

// One linked number for the tenant.
export interface WhatsAppSessionInfo {
  slot: number;
  label?: string | null;
  status: WhatsAppQrStatus;
  number?: string | null;
}

export interface WhatsAppSessionsResponse {
  success: boolean;
  sessions: WhatsAppSessionInfo[];
  maxSlots: number;
}

// The backend FORCES the tenant to the logged-in user; the URL param carries
// the SLOT (which linked number: 1, 2, …), so a clinic can link multiple
// WhatsApp numbers. Slot defaults to 1 for back-compat.
const QR_BASE = "/whatsapp-qr";

export const whatsappQrService = {
  async status(slot = 1): Promise<WhatsAppQrState> {
    const { data } = await api.get<WhatsAppQrState>(`${QR_BASE}/${slot}/status`);
    return data;
  },
  async qr(slot = 1): Promise<WhatsAppQrState> {
    const { data } = await api.get<WhatsAppQrState>(`${QR_BASE}/${slot}/qr`);
    return data;
  },
  async connect(slot = 1): Promise<WhatsAppQrState> {
    const { data } = await api.post<WhatsAppQrState>(`${QR_BASE}/${slot}/connect`, {});
    return data;
  },
  async logout(slot = 1): Promise<WhatsAppQrState> {
    const { data } = await api.post<WhatsAppQrState>(`${QR_BASE}/${slot}/logout`, {});
    return data;
  },
  // List every linked-number slot for the tenant (drives the multi-session UI).
  async sessions(): Promise<WhatsAppSessionsResponse> {
    const { data } = await api.get<WhatsAppSessionsResponse>(`${QR_BASE}/sessions`);
    return data;
  },
};
