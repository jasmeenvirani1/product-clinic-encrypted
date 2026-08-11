import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";

export interface AISetting {
  id: number;
  tenant_id: number;
  ai_tone: "professional" | "warm" | "premium" | "friendly" | "formal";
  prompt_instructions: string;
  /** Platform's default prompt — shown as the starting point when the clinic hasn't set its own. */
  platform_default_prompt: string;
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
  /** Tenant's real plan-derived cap. `null` = unlimited plan (Enterprise/Custom). */
  maxSlots: number | null;
  used: number;
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
  // Permanently delete a slot (DB row + on-disk session). Distinct from
  // logout, which only unlinks the number but keeps the card/slot around.
  async remove(slot = 1): Promise<WhatsAppSessionsResponse> {
    const { data } = await api.delete<WhatsAppSessionsResponse>(`${QR_BASE}/${slot}/remove`);
    return data;
  },
  // List every linked-number slot for the tenant (drives the multi-session UI).
  async sessions(): Promise<WhatsAppSessionsResponse> {
    const { data } = await api.get<WhatsAppSessionsResponse>(`${QR_BASE}/sessions`);
    return data;
  },
};

// ─── Instagram Meta channel (BYO Meta Developer App — each clinic brings ───
// ─── their own App ID/App Secret/Access Token, NOT an OAuth redirect). The ───
// ─── clinic enters their own credentials, then pastes MedLeads' generated ───
// ─── webhook URL + verify token into THEIR Meta App's webhook config. ───
export type InstagramMetaStatus = "disconnected" | "connected" | "error";

export interface InstagramMetaCredentialsPayload {
  meta_app_id: string;
  meta_app_secret: string;
  access_token: string;
  ig_business_account_id: string;
}

export interface InstagramMetaState {
  success: boolean;
  status: InstagramMetaStatus;
  ig_username?: string | null;
  last_error?: string | null;
  /** True once credentials have been saved at least once (drives showing the webhook info block). */
  has_credentials?: boolean;
  /** Masked view of the saved App Secret, e.g. "••••••cd12" — never the raw value. */
  meta_app_secret_masked?: string | null;
  /** Masked view of the saved Access Token. */
  access_token_masked?: string | null;
  meta_app_id?: string | null;
  ig_business_account_id?: string | null;
}

export interface InstagramMetaWebhookInfo {
  success: boolean;
  /** The unique callback/webhook URL this clinic pastes into their Meta App's webhook config. */
  webhook_url: string;
  /** The unique verify token this clinic pastes into the same Meta App webhook config. */
  verify_token: string;
}

// The backend FORCES the tenant to the logged-in user; the URL param carries
// the SLOT, same convention as whatsappQrService/the old instagramOAuthService.
// Slot defaults to 1 (one Meta App connection per clinic today).
const IG_META_BASE = "/instagram-meta";

export const instagramMetaService = {
  async status(slot = 1): Promise<InstagramMetaState> {
    const { data } = await api.get<InstagramMetaState>(`${IG_META_BASE}/${slot}/status`);
    return data;
  },
  // Clinic manually enters their own Meta App credentials — saved to the
  // backend, which then generates/returns the per-tenant webhook URL + verify
  // token (fetched separately via webhookInfo()).
  async saveCredentials(
    payload: InstagramMetaCredentialsPayload,
    slot = 1
  ): Promise<InstagramMetaState> {
    const { data } = await api.put<InstagramMetaState>(`${IG_META_BASE}/${slot}/credentials`, payload);
    return data;
  },
  async webhookInfo(slot = 1): Promise<InstagramMetaWebhookInfo> {
    const { data } = await api.get<InstagramMetaWebhookInfo>(`${IG_META_BASE}/${slot}/webhook-info`);
    return data;
  },
  async disconnect(slot = 1): Promise<{ success: boolean }> {
    const { data } = await api.post<{ success: boolean }>(`${IG_META_BASE}/${slot}/disconnect`, {});
    return data;
  },
};
