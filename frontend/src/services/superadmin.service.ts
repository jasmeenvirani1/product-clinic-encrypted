import { api } from "../utils/API";
import type { PaymentRecord, PlanFeatureFlags, PlanRecord, SubscriptionRecord, VideoRecord } from "../utils/types";
import { clone, sleep } from "./helpers";
import { mockIntegrationKeys, mockUsers } from "./mockData";
import { formatDate } from "@/lib/utils";

interface BackendPlanResponse {
  id: number;
  plan_name: string;
  price: number | string;
  monthly_price: number | string;
  yearly_price: number | string;
  period: "monthly" | "yearly";
  features: unknown;
  feature_flags?: PlanFeatureFlags;
  is_active: boolean;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaymentResponse {
  id: number;
  amount: number | string;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paid_at: string | null;
  createdAt: string;
  payment_method: string | null;
  transaction_id: string | null;
  plan_name: string | null;
  billing_period: "monthly" | "yearly" | null;
  User?: {
    id: number;
    full_name: string;
    email: string;
    tenant_id: number | null;
    Role?: { id: number; name: string };
  };
}

interface BackendSubscriptionResponse {
  user: {
    id: number;
    full_name: string;
    email: string;
    role: string | null;
    tenant_id: number | null;
    is_active: boolean;
  };
  subscription: {
    plan_name: string | null;
    plan_period: "monthly" | "yearly" | null;
    plan_started_at: string | null;
    plan_expires_at: string | null;
  };
  payments: {
    latest: {
      id: number;
      status: "pending" | "paid" | "failed" | "refunded";
      paid_at: string | null;
      createdAt?: string;
      created_at?: string;
    } | null;
  };
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface PlanPayload {
  name: string;
  period?: "monthly" | "yearly";
  price?: number;
  monthly_price?: number;
  yearly_price?: number;
  features?: string[];
  feature_flags?: PlanFeatureFlags;
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const mapPlan = (item: BackendPlanResponse): PlanRecord => ({
  id: item.id,
  name: item.plan_name,
  price: Number(item.price ?? 0),
  monthly_price: Number(item.monthly_price ?? 0),
  yearly_price: Number(item.yearly_price ?? 0),
  period: item.period,
  features: toStringArray(item.features),
  feature_flags: item.feature_flags,
});

const mapPayment = (item: BackendPaymentResponse): PaymentRecord => {
  const paidDate = item.paid_at || item.createdAt;
  return {
    id: String(item.id),
    tenantName: item.User?.full_name || "—",
    amount: Number(item.amount ?? 0),
    status: item.status,
    date: paidDate ? formatDate(paidDate) : "—",
    method: item.payment_method || "—",
    userName: item.User?.full_name || "—",
    userEmail: item.User?.email || "—",
    role: item.User?.Role?.name || "—",
    planName: item.plan_name || "—",
    period: item.billing_period || null,
    currency: item.currency || "USD",
    transactionId: item.transaction_id || "—",
  };
};

const mapSubscription = (item: BackendSubscriptionResponse): SubscriptionRecord => {
  const startedAt = item.subscription.plan_started_at;
  const renewalDate = item.subscription.plan_expires_at;
  const latestStatus = item.payments.latest?.status;

  let status: SubscriptionRecord["status"] = "active";
  if (!item.user.is_active) status = "past_due";
  else if (latestStatus === "pending" || latestStatus === "failed") status = "past_due";
  else if (latestStatus === "refunded") status = "trial";

  return {
    id: String(item.user.id),
    tenantName: item.user.full_name,
    planName: item.subscription.plan_name || "—",
    seats: 1,
    renewalDate: renewalDate ? formatDate(renewalDate) : "—",
    status,
    userName: item.user.full_name,
    userEmail: item.user.email,
    role: item.user.role || "—",
    period: item.subscription.plan_period || null,
    purchaseDate: startedAt ? formatDate(startedAt) : "—",
    planExpiresAt: renewalDate ? formatDate(renewalDate) : "—",
    latestPaymentStatus: latestStatus || "—",
  };
};

export interface PlatformUseCase {
  title: string;
  example_question: string;
  correct_answer: string;
}

export interface PlatformAIDefaults {
  id: number;
  default_openai_model: string;
  default_openai_base_url: string | null;
  default_prompt_instructions: string;
  /** Separate, independent prompt reserved for the self-chat answer flow. */
  self_chat_prompt: string | null;
  default_ai_tone: "professional" | "warm" | "premium" | "friendly" | "formal";
  allow_tenant_model_change: boolean;
  use_cases: PlatformUseCase[];
  /** Masked value (•••1234) — never the raw key. */
  platform_openai_api_key?: string | null;
  has_platform_openai_api_key?: boolean;
}

export interface TenantAISummary {
  tenant_id: number;
  tenant_name: string;
  tenant_email: string;
  is_active: boolean;
  openai_model: string;
  has_api_key: boolean;
  openai_api_key_masked: string | null;
  ai_tone: string;
  has_whatsapp: boolean;
  has_instagram: boolean;
  updated_at: string;
}

export const superadminService = {
  async getUsers() {
    await sleep(650);
    return clone(mockUsers);
  },

  async getSubscriptions(): Promise<SubscriptionRecord[]> {
    const { data } = await api.get<ApiResponse<BackendSubscriptionResponse[]>>("/super-admin/subscriptions");
    return (data.data ?? []).map(mapSubscription);
  },

  async getPayments(): Promise<PaymentRecord[]> {
    const { data } = await api.get<ApiResponse<BackendPaymentResponse[]>>("/super-admin/payments");
    return (data.data ?? []).map(mapPayment);
  },

  async getPlans(): Promise<PlanRecord[]> {
    const { data } = await api.get<ApiResponse<BackendPlanResponse[]>>("/plans");
    return (data.data ?? []).map(mapPlan);
  },

  async createPlan(payload: PlanPayload): Promise<PlanRecord> {
    const { data } = await api.post<ApiResponse<BackendPlanResponse>>("/plans", {
      plan_name: payload.name,
      period: payload.period,
      price: payload.price,
      monthly_price: payload.monthly_price,
      yearly_price: payload.yearly_price,
      features: payload.features ?? [],
      feature_flags: payload.feature_flags,
    });
    return mapPlan(data.data);
  },

  async updatePlan(id: number, payload: PlanPayload): Promise<PlanRecord> {
    const { data } = await api.put<ApiResponse<BackendPlanResponse>>(`/plans/${id}`, {
      plan_name: payload.name,
      period: payload.period,
      price: payload.price,
      monthly_price: payload.monthly_price,
      yearly_price: payload.yearly_price,
      features: payload.features ?? [],
      feature_flags: payload.feature_flags,
    });
    return mapPlan(data.data);
  },

  async deletePlan(id: number): Promise<void> {
    await api.delete(`/plans/${id}`);
  },

  async getVideos(): Promise<VideoRecord[]> {
    const { data } = await api.get<ApiResponse<VideoRecord[]>>("/videos");
    return data.data ?? [];
  },

  async createVideo(formData: FormData): Promise<VideoRecord> {
    const { data } = await api.post<ApiResponse<VideoRecord>>("/videos", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async updateVideo(id: number, formData: FormData): Promise<VideoRecord> {
    const { data } = await api.put<ApiResponse<VideoRecord>>(`/videos/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async deleteVideo(id: number): Promise<void> {
    await api.delete(`/videos/${id}`);
  },

  async getPlatformAIDefaults(): Promise<PlatformAIDefaults> {
    const { data } = await api.get<ApiResponse<PlatformAIDefaults>>("/super-admin/ai-settings/defaults");
    return data.data;
  },

  async updatePlatformAIDefaults(payload: Partial<PlatformAIDefaults>): Promise<PlatformAIDefaults> {
    const { data } = await api.put<ApiResponse<PlatformAIDefaults>>("/super-admin/ai-settings/defaults", payload);
    return data.data;
  },

  async getTenantAISettings(): Promise<TenantAISummary[]> {
    const { data } = await api.get<ApiResponse<TenantAISummary[]>>("/super-admin/ai-settings/tenants");
    return data.data ?? [];
  },

  async getIntegrations() {
    await sleep(650);
    return clone(mockIntegrationKeys.filter((item) => item.scope === "global"));
  },
};
