"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Tag } from "antd";
import { CheckCircle2, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { billingService } from "@/services/billing.service";
import { formatCurrency } from "@/lib/utils";
import type { PlanRecord } from "@/utils/types";

const STEPS = ["Register", "Upload Docs", "Select Plan", "Setup"];
type Period = "monthly" | "yearly";

export default function SelectPlanPage() {
  const { message } = App.useApp();
  const router = useRouter();

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("monthly");
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);

  useEffect(() => {
    billingService
      .getBillingSummary()
      .then((s) => {
        setPlans(s.allPlans ?? []);
        if (s.purchasedPlan) setActivePlanId(Number(s.purchasedPlan.id));
      })
      .catch(() => void message.error("Failed to load plans."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async (plan: PlanRecord) => {
    const planId = Number(plan.id);
    setPurchasingId(planId);
    try {
      const session = await billingService.createStripeCheckoutSession(
        planId,
        period,
        "/onboarding/payment-confirm"
      );
      if (!session?.checkout_url) {
        void message.error("Unable to start checkout. Please try again.");
        return;
      }
      window.location.href = session.checkout_url;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      void message.error(e?.response?.data?.message ?? "Purchase failed.");
    } finally {
      setPurchasingId(null);
    }
  };

  const price = (plan: PlanRecord) =>
    period === "yearly" ? (plan.yearly_price ?? plan.price) : (plan.monthly_price ?? plan.price);

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex flex-1 last:flex-none items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                idx < 2 ? "bg-emerald-500 text-white" : idx === 2 ? "bg-emerald-600 text-white ring-2 ring-emerald-200" : "bg-slate-200 text-slate-400"
              }`}>
                {idx < 2 ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className={`hidden text-[10px] font-medium sm:block ${idx === 2 ? "text-emerald-700" : "text-slate-400"}`}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${idx < 2 ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-50 p-2.5 shrink-0">
          <Zap size={20} className="text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Choose your plan</h1>
          <p className="mt-0.5 text-sm text-slate-500">Select a plan or start your <span className="font-semibold text-primary">14-day free trial</span>. You can upgrade anytime from billing.</p>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(["monthly", "yearly"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`cursor-pointer rounded-lg border-none px-4 py-1.5 text-sm font-medium transition-all ${
              period === p ? "bg-white text-slate-900 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {p === "monthly" ? "Monthly" : "Yearly"}
            {p === "yearly" && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Save ~17%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plans */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-400">Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="py-20 text-center text-sm text-slate-400">No plans available. Contact support.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const planId = Number(plan.id);
            const isActive = activePlanId === planId;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-all ${
                  isActive ? "border-emerald-400 ring-2 ring-emerald-100 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Tag color="green" className="px-2 text-xs font-semibold">Current Plan</Tag>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-3xl font-bold text-slate-900">{formatCurrency(Number(price(plan)))}</span>
                    <span className="mb-1 text-sm text-slate-400">/ {period === "yearly" ? "yr" : "mo"}</span>
                  </div>
                </div>
                <ul className="mb-6 flex-1 space-y-2">
                  {(plan.features ?? []).map((f, i) => (
                    <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  type={isActive ? "default" : "primary"}
                  block
                  disabled={isActive}
                  loading={purchasingId === planId}
                  icon={!isActive ? <ArrowRight size={14} /> : undefined}
                  iconPosition="end"
                  onClick={() => !isActive && void handlePurchase(plan)}
                >
                  {isActive ? "Active" : "Get started"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Skip */}
      <div className="pb-4 text-center">
        <button
          type="button"
          onClick={() => router.push("/app/dashboard")}
          className="cursor-pointer border-none bg-transparent p-0 text-sm text-slate-400 transition-colors hover:text-slate-600"
        >
          Skip for now — start my 14-day free trial
        </button>
      </div>
    </div>
  );
}
