"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Segmented, Select, Tabs, Tag, message } from "antd";
import {
  AlertCircle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Calendar,
  CheckCircle2,
  CreditCard,
  // Megaphone,
  Receipt,
  Sparkles,
  Zap,
} from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { billingService } from "@/services/billing.service";
import { renderStatus } from "@/components/ui/StatusTag";
import { formatCurrency } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { BillingSummary, PaymentRecord, PlanRecord } from "@/utils/types";
import { APP_FULL_NAME } from "@/constants/brand";

// ─── Brand-anchored plan card gradients ──────────────────────────────
// Every gradient is built from shades of the project brand teal
// Uses primary color scale only — no off-brand hues.
const PLAN_GRADIENTS = [
  "from-[#bae6fd] via-[#7dd3fc] to-primary",    // light → brand
  "from-[#7dd3fc] via-primary to-primary-dark",  // mid lift
  "from-primary via-primary-dark to-[#0c4a6e]",  // brand → deep
  "from-[#bae6fd] via-primary to-[#0c4a6e]",     // soft → deep
  "from-primary via-[#0c4a6e] to-[#082f49]",     // deepest
] as const;

const planPrice = (p: PlanRecord, period: "monthly" | "yearly"): number => {
  if (period === "yearly") return Number(p.yearly_price ?? p.price ?? 0);
  return Number(p.monthly_price ?? p.price ?? 0);
};

// ─── Invoice download helper (HTML, opens nicely in browser) ─────────
const downloadInvoiceHtml = (record: PaymentRecord) => {
  const safe = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  const amount = Number(record.amount || 0);
  const subtotal = amount;
  const tax = 0;
  const total = subtotal + tax;
  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const issueDate = safe(record.date);
  const invoiceNo =
    record.transactionId
      ? String(record.transactionId).slice(-10).toUpperCase()
      : `INV-${String(record.id).padStart(6, "0")}`;
  const statusKey = String(record.status || "").toLowerCase();
  const statusPalette: Record<string, { bg: string; fg: string }> = {
    paid:     { bg: "#ecfdf5", fg: "#0f766e" },
    pending:  { bg: "#fef3c7", fg: "#92400e" },
    failed:   { bg: "#fee2e2", fg: "#991b1b" },
    refunded: { bg: "#e0e7ff", fg: "#3730a3" },
  };
  const statusStyle = statusPalette[statusKey] || { bg: "#e2e8f0", fg: "#334155" };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${invoiceNo} — ${APP_FULL_NAME}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    line-height: 1.55;
    padding: 40px 16px;
  }
  .invoice {
    max-width: 820px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.08);
  }
  .accent {
    height: 6px;
    background: linear-gradient(90deg, #1F9D8B, #14b8a6, #0f6f60);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 36px 44px 28px;
    gap: 24px;
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 46px; height: 46px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1F9D8B, #0f6f60);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 18px;
    letter-spacing: 0.04em;
    box-shadow: 0 6px 16px rgba(31, 157, 139, 0.32);
  }
  .brand-name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .brand-tag  { font-size: 11px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
  .invoice-meta { text-align: right; }
  .invoice-meta .label { font-size: 10px; color: #94a3b8; letter-spacing: 0.12em; text-transform: uppercase; }
  .invoice-meta .value { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; margin-top: 2px; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 8px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    background: ${statusStyle.bg};
    color: ${statusStyle.fg};
  }
  .status-dot {
    width: 6px; height: 6px; border-radius: 9999px;
    background: ${statusStyle.fg};
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 0 44px 28px;
  }
  .party {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px 20px;
  }
  .party h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .party .name { font-size: 14px; font-weight: 600; color: #0f172a; }
  .party .line { font-size: 12px; color: #64748b; margin-top: 2px; }
  .dates {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 0 44px 24px;
  }
  .date-cell {
    border-top: 1px solid #e2e8f0;
    padding-top: 14px;
  }
  .date-cell .label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .date-cell .value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 4px; }
  table.items {
    width: calc(100% - 88px);
    margin: 0 44px;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  table.items thead th {
    background: #f8fafc;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10.5px;
    font-weight: 600;
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
  }
  table.items td {
    padding: 18px 16px;
    font-size: 13px;
    color: #0f172a;
    border-bottom: 1px solid #f1f5f9;
  }
  table.items tr:last-child td { border-bottom: none; }
  table.items td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.items td.muted { color: #64748b; }
  .totals {
    margin: 24px 44px 0;
    display: flex;
    justify-content: flex-end;
  }
  .totals-inner {
    width: 320px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px 20px;
  }
  .totals-row {
    display: flex; justify-content: space-between;
    font-size: 13px;
    padding: 6px 0;
    color: #475569;
  }
  .totals-row.grand {
    font-size: 16px; font-weight: 700; color: #0f172a;
    border-top: 1px solid #e2e8f0;
    margin-top: 8px;
    padding-top: 12px;
  }
  .totals-row.grand .amount { color: #1F9D8B; font-size: 18px; }
  .thanks {
    margin: 28px 44px 0;
    padding: 16px 20px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(31, 157, 139, 0.08), rgba(15, 111, 96, 0.04));
    border: 1px solid rgba(31, 157, 139, 0.18);
    color: #0f6f60;
    font-size: 13px;
  }
  .footer {
    margin-top: 28px;
    padding: 20px 44px 36px;
    border-top: 1px dashed #cbd5e1;
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .invoice { box-shadow: none; border-radius: 0; }
  }
  @media (max-width: 640px) {
    .header, .parties, .dates, .totals, .thanks, .footer { padding-left: 22px; padding-right: 22px; }
    table.items { width: calc(100% - 44px); margin: 0 22px; }
    .parties { grid-template-columns: 1fr; }
    .dates { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
  <div class="invoice">
    <div class="accent"></div>

    <div class="header">
      <div class="brand">
        <div class="logo">M</div>
        <div>
          <div class="brand-name">${APP_FULL_NAME}</div>
          <div class="brand-tag">AI-powered clinic CRM</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="label">Invoice</div>
        <div class="value">#${invoiceNo}</div>
        <div class="status-pill">
          <span class="status-dot"></span>${safe(record.status).toUpperCase()}
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Billed To</h3>
        <div class="name">${safe(record.userName ?? record.tenantName)}</div>
        <div class="line">${safe(record.userEmail ?? "")}</div>
        ${record.tenantName && record.userName ? `<div class="line">${safe(record.tenantName)}</div>` : ""}
      </div>
      <div class="party">
        <h3>Billed From</h3>
        <div class="name">${APP_FULL_NAME}</div>
        <div class="line">support@medleads.ai</div>
        <div class="line">All transactions in USD ($)</div>
      </div>
    </div>

    <div class="dates">
      <div class="date-cell">
        <div class="label">Issue Date</div>
        <div class="value">${issueDate}</div>
      </div>
      <div class="date-cell">
        <div class="label">Billing Period</div>
        <div class="value">${safe(record.period)}</div>
      </div>
      <div class="date-cell">
        <div class="label">Payment Method</div>
        <div class="value">${safe(record.method)}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th>Transaction ID</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight:600">${safe(record.planName)}</div>
            <div class="muted" style="font-size:11px;margin-top:2px">Subscription · ${safe(record.period) || "monthly"}</div>
          </td>
          <td class="muted">${safe(record.period)}</td>
          <td class="muted" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px">${safe(record.transactionId)}</td>
          <td class="right">${fmt(amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-inner">
        <div class="totals-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div class="totals-row"><span>Tax</span><span>${fmt(tax)}</span></div>
        <div class="totals-row grand"><span>Total Due</span><span class="amount">${fmt(total)}</span></div>
      </div>
    </div>

    <div class="thanks">
      Thank you for your business. This invoice is computer-generated and does not require a signature.
    </div>

    <div class="footer">
      <span>Generated by ${APP_FULL_NAME}</span>
      <span>Need help? support@medleads.ai</span>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function BillingPage() {
  const { user } = useCurrentUser();
  const isPlanExpired = user?.isPlanExpired ?? false;
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasingPlanId, setPurchasingPlanId] = useState<number | null>(null);
  const [periodByPlan, setPeriodByPlan] = useState<Record<number, "monthly" | "yearly">>({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await billingService.getBillingSummary();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const stripeStatus = params.get("stripe_status");
      const sessionId = params.get("session_id");

      if (stripeStatus === "success" && sessionId) {
        try {
          await billingService.confirmStripeCheckoutSession(sessionId);
          message.success("Payment confirmed and plan activated.");
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } };
          message.error(err?.response?.data?.message || "Payment verification failed.");
        } finally {
          const url = new URL(window.location.href);
          url.searchParams.delete("stripe_status");
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        }
      }

      if (stripeStatus === "cancelled") {
        message.info("Payment was cancelled.");
        const url = new URL(window.location.href);
        url.searchParams.delete("stripe_status");
        url.searchParams.delete("payment_id");
        window.history.replaceState({}, "", url.toString());
      }

      await load();
    };

    void run();
  }, []);

  const currentPlan = summary?.purchasedPlan ?? null;
  const allPlans = summary?.allPlans ?? [];

  // const campaignRemainingLabel = (() => {
  //   if (summary?.campaignLimit == null) return "—";
  //   if (summary.campaignLimit <= 0)     return "Not included";
  //   return `${summary.campaignRemaining ?? 0} / ${summary.campaignLimit}`;
  // })();

  const kpis = [
    { label: "Monthly Spend",       value: summary?.monthlySpend ?? "—",  icon: CreditCard, iconColor: "!text-emerald-500", iconBg: "bg-emerald-50" },
    { label: "Next Renewal",        value: summary?.renewalDate ?? "—",   icon: Calendar,   iconColor: "!text-violet-500",  iconBg: "bg-violet-50"  },
    { label: "Current Plan",        value: summary?.currentPlan ?? "—",   icon: Zap,        iconColor: "!text-amber-500",   iconBg: "bg-amber-50"   },
    // { label: "Campaigns Remaining", value: campaignRemainingLabel,         icon: Megaphone,  iconColor: "!text-blue-500",    iconBg: "bg-blue-50"    },
  ];

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    return (summary?.history ?? []).filter((r) => {
      const matchSearch = !q || (r.planName ?? "").toLowerCase().includes(q) || r.method.toLowerCase().includes(q) || (r.transactionId ?? "").toLowerCase().includes(q);
      const matchStatus = !historyStatus || r.status === historyStatus;
      return matchSearch && matchStatus;
    });
  }, [summary?.history, historySearch, historyStatus]);

  const handlePurchase = async (plan: PlanRecord) => {
    const planId = Number(plan.id);
    const selectedPeriod = periodByPlan[planId] || "monthly";

    try {
      setPurchasingPlanId(planId);
      const session = await billingService.createStripeCheckoutSession(planId, selectedPeriod);
      if (!session?.checkout_url) {
        message.error("Unable to start payment checkout.");
        return;
      }
      window.location.href = session.checkout_url;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err?.response?.data?.message || "Purchase failed.");
    } finally {
      setPurchasingPlanId(null);
    }
  };

  // ── Plans tab ─────────────────────────────────────────────────────
  const plansTab = (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="crm-card flex items-center justify-between p-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kpi.label}</p>
              <p className="mt-1.5 truncate text-2xl font-bold text-slate-800">{kpi.value}</p>
            </div>
            <div className={`${kpi.iconBg} shrink-0 rounded-xl p-3 ml-4`}>
              <kpi.icon size={22} className={kpi.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div>
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-slate-900">Available Plans</h3>
          <p className="text-xs text-slate-400">
            {currentPlan
              ? `Currently on ${currentPlan.name}. Upgrade for more capacity or downgrade anytime.`
              : "Choose a plan to activate billing."}
          </p>
        </div>

        {/*
          Card width adapts to the number of plans:
          1 plan  → single centred card
          2 plans → 2 columns from sm
          3 plans → 2 columns from sm, 3 from lg (so 3 plans fill the row evenly)
          4+      → 2 cols sm, 3 lg, 4 xl (caps so cards never get too narrow)
        */}
        <div
          className={`grid gap-5 ${
            allPlans.length === 1
              ? "grid-cols-1 max-w-md"
              : allPlans.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-3xl"
              : allPlans.length === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }`}
        >
          {allPlans.map((plan, idx) => {
            const planId = Number(plan.id);
            const period = periodByPlan[planId] || "monthly";
            const price = planPrice(plan, period);
            const isCurrent = !!currentPlan && Number(currentPlan.id) === planId;
            const currentPrice = currentPlan ? planPrice(currentPlan, period) : null;

            const isExpiredCurrent = isCurrent && isPlanExpired;

            let actionLabel: string = "Choose Plan";
            let actionIcon: React.ReactNode = <Sparkles size={14} />;
            if (isExpiredCurrent) {
              actionLabel = "Renew Plan";
              actionIcon = <Zap size={14} />;
            } else if (isCurrent) {
              actionLabel = "Current Plan";
              actionIcon = <CheckCircle2 size={14} />;
            } else if (currentPrice != null && price > currentPrice) {
              actionLabel = "Upgrade";
              actionIcon = <ArrowUp size={14} />;
            } else if (currentPrice != null && price < currentPrice) {
              actionLabel = "Downgrade";
              actionIcon = <ArrowDown size={14} />;
            }

            const gradient = PLAN_GRADIENTS[idx % PLAN_GRADIENTS.length];
            const features = plan.features ?? [];

            return (
              <div
                key={planId}
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                  isExpiredCurrent
                    ? "border-red-400 ring-2 ring-red-400/20"
                    : isCurrent
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-slate-200"
                }`}
              >
                {/* Gradient header */}
                <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} px-5 pb-7 pt-5 text-white`}>
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
                  <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/85">Plan</p>
                      <h4 className="mt-0.5 text-xl font-bold leading-tight">{plan.name}</h4>
                    </div>
                    {isExpiredCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/30">
                        <AlertCircle size={10} /> Expired
                      </span>
                    )}
                    {isCurrent && !isPlanExpired && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/30">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </div>
                  <div className="relative mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCurrency(price)}</span>
                    <span className="text-xs text-white/85">/ {period === "yearly" ? "yr" : "mo"}</span>
                  </div>
                  <p className="relative mt-1 text-[11px] font-semibold text-white">
                    An additional $30 will be charged for each appointment booked
                  </p>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Billing period
                    </p>
                    <Segmented
                      block
                      size="small"
                      value={period}
                      onChange={(val) =>
                        setPeriodByPlan((prev) => ({ ...prev, [planId]: val as "monthly" | "yearly" }))
                      }
                      options={[
                        { value: "monthly", label: "Monthly" },
                        { value: "yearly",  label: "Yearly" },
                      ]}
                    />
                  </div>

                  <div className="flex-1">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      What&apos;s included
                    </p>
                    <ul className="space-y-1.5">
                      {features.length === 0 && (
                        <li className="text-xs text-slate-400">No features listed.</li>
                      )}
                      {features.slice(0, 6).map((f, i) => (
                        <li key={`${f}-${i}`} className="flex items-start gap-2 text-[13px] text-slate-700">
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    block
                    type={isExpiredCurrent ? "primary" : isCurrent ? "default" : "primary"}
                    icon={actionIcon}
                    disabled={(isCurrent && !isExpiredCurrent) || loading}
                    loading={purchasingPlanId === planId}
                    onClick={() => void handlePurchase(plan)}
                    danger={isExpiredCurrent}
                  >
                    {actionLabel}
                  </Button>
                </div>
              </div>
            );
          })}
          {allPlans.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              No plans configured yet. Ask your super admin to publish plans.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Payment history tab ───────────────────────────────────────────
  const historyTab = (
    <DataTable
      cardTitle="Payment History"
      subtitle="All charges, refunds, and transactions on your account. Download an invoice for any paid record."
      rowKey="id"
      dataSource={filteredHistory}
      filters={
        <div className="flex items-center gap-2">
          <Select
            placeholder="All Statuses"
            allowClear
            value={historyStatus}
            onChange={(val) => setHistoryStatus(val ?? null)}
            style={{ width: 150 }}
            options={[
              { value: "paid",     label: "Paid"     },
              { value: "pending",  label: "Pending"  },
              { value: "failed",   label: "Failed"   },
              { value: "refunded", label: "Refunded" },
            ]}
          />
          <Input.Search
            placeholder="Search by plan or transaction..."
            allowClear
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
      }
      columns={[
        { title: "Plan", dataIndex: "planName" },
        {
          title: "Period",
          dataIndex: "period",
          render: (v: string | null) =>
            v ? <Tag color="blue" className="capitalize">{v}</Tag> : "—",
        },
        { title: "Amount", dataIndex: "amount", render: (v: number) => formatCurrency(Number(v || 0)) },
        { title: "Date", dataIndex: "date" },
        { title: "Method", dataIndex: "method" },
        {
          title: "Transaction",
          dataIndex: "transactionId",
          render: (v: string | null) =>
            v ? <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">{v}</code> : "—",
        },
        { title: "Status", dataIndex: "status", render: renderStatus },
        {
          title: "Invoice",
          key: "invoice",
          width: 130,
          render: (_: unknown, record: PaymentRecord) => (
            <Button
              size="small"
              icon={<ArrowDownToLine size={13} />}
              disabled={record.status !== "paid"}
              onClick={() => downloadInvoiceHtml(record)}
            >
              Download
            </Button>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      <PageSection
        eyebrow="Clnic CRM"
        title="Billing"
        description="Manage your plan and review every payment on your account."
      />
      <Tabs
        defaultActiveKey="plans"
        items={[
          {
            key: "plans",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={13} /> Plans
              </span>
            ),
            children: plansTab,
          },
          {
            key: "history",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Receipt size={13} /> Payment History
                {filteredHistory.length > 0 && (
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">
                    {filteredHistory.length}
                  </span>
                )}
              </span>
            ),
            children: historyTab,
          },
        ]}
      />
    </div>
  );
}
