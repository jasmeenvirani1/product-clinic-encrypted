import { api } from "../utils/API";
import type { BillingSummary, PaymentRecord, PlanRecord } from "../utils/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface BackendPlan {
  id: number;
  plan_name: string;
  price: number | string;
  monthly_price: number | string;
  yearly_price: number | string;
  period: "monthly" | "yearly";
  campaign_count: number;
  features: unknown;
}

interface BackendPayment {
  id: number;
  amount: number | string;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paid_at: string | null;
  createdAt?: string;
  created_at?: string;
  payment_method: string | null;
  transaction_id: string | null;
  plan_name: string | null;
  billing_period: "monthly" | "yearly" | null;
}

interface AuthMeResponse {
  user: {
    id: number;
    full_name: string;
    email: string;
    mobile: string | null;
    role: string;
  };
  planContext?: {
    plan_id: number | null;
    period: "monthly" | "yearly" | null;
    started_at: string | null;
    expires_at: string | null;
    access?: {
      plan_name?: string;
      campaign_count?: number;
      features?: string[];
    };
    campaign_limit?: number | null;
    campaign_used?: number;
    campaign_remaining?: number | null;
    plan?: {
      id: number;
      name: string;
      monthly_price: number | string;
      yearly_price: number | string;
      period: "monthly" | "yearly";
    } | null;
  };
}

interface StripeCheckoutData {
  payment_id: number;
  session_id: string;
  checkout_url: string;
  publishable_key: string;
}

interface StripeConfirmData {
  status: "paid" | "failed";
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
};

const mapPlan = (p: BackendPlan): PlanRecord => ({
  id: p.id,
  name: p.plan_name,
  price: Number(p.price ?? 0),
  monthly_price: Number(p.monthly_price ?? 0),
  yearly_price: Number(p.yearly_price ?? 0),
  period: p.period,
  campaign_count: Number(p.campaign_count ?? 0),
  features: toStringArray(p.features),
});

const mapPayment = (p: BackendPayment): PaymentRecord => ({
  id: String(p.id),
  tenantName: "My Account",
  amount: Number(p.amount ?? 0),
  status: p.status,
  date: p.paid_at || p.createdAt || p.created_at ? formatDate(p.paid_at || p.createdAt || p.created_at || "") : "—",
  method: p.payment_method || "—",
  planName: p.plan_name || "—",
  period: p.billing_period,
  currency: p.currency || "USD",
  transactionId: p.transaction_id || "—",
});

const formatMoney = (amount: number) => formatCurrency(amount);

export const billingService = {
  async getPayments(): Promise<PaymentRecord[]> {
    const { data } = await api.get<ApiResponse<BackendPayment[]>>("/payment-history");
    return (data.data ?? []).map(mapPayment);
  },

  async purchasePlan(planId: number, period: "monthly" | "yearly") {
    const { data } = await api.post<ApiResponse<unknown>>("/payment-history/purchase", {
      plan_id: planId,
      period,
      payment_method: "manual",
    });
    return data;
  },

  async createStripeCheckoutSession(planId: number, period: "monthly" | "yearly", returnPath?: string) {
    const { data } = await api.post<ApiResponse<StripeCheckoutData>>("/payment-history/stripe/checkout-session", {
      plan_id: planId,
      period,
      ...(returnPath ? { return_path: returnPath } : {}),
    });
    return data.data;
  },

  async confirmStripeCheckoutSession(sessionId: string) {
    const { data } = await api.post<ApiResponse<StripeConfirmData>>("/payment-history/stripe/confirm-session", {
      session_id: sessionId,
    });
    return data.data;
  },

  async getBillingSummary(): Promise<BillingSummary> {
    const [plansRes, paymentsRes, meRes] = await Promise.all([
      api.get<ApiResponse<BackendPlan[]>>("/plans"),
      api.get<ApiResponse<BackendPayment[]>>("/payment-history"),
      api.get<ApiResponse<AuthMeResponse>>("/auth/me"),
    ]);

    const allPlans = (plansRes.data.data ?? []).map(mapPlan);
    const history = (paymentsRes.data.data ?? []).map(mapPayment);
    const planContext = meRes.data.data?.planContext;

    let purchasedPlan: PlanRecord | null = null;
    if (planContext?.plan?.id) {
      purchasedPlan = allPlans.find((p) => Number(p.id) === Number(planContext.plan?.id)) || null;
    }
    if (!purchasedPlan && planContext?.access?.plan_name) {
      purchasedPlan = allPlans.find((p) => p.name.toLowerCase() === String(planContext.access?.plan_name).toLowerCase()) || null;
    }

    const monthlySpend = history.filter((h) => h.status === "paid").reduce((sum, h) => sum + Number(h.amount || 0), 0);

    return {
      currentPlan: purchasedPlan?.name || planContext?.plan?.name || planContext?.access?.plan_name || "—",
      renewalDate: planContext?.expires_at ? formatDate(planContext.expires_at) : "—",
      monthlySpend: formatMoney(monthlySpend),
      history,
      allPlans,
      purchasedPlan,
      campaignLimit: planContext?.campaign_limit ?? null,
      campaignUsed: planContext?.campaign_used ?? 0,
      campaignRemaining: planContext?.campaign_remaining ?? null,
    };
  },
};
