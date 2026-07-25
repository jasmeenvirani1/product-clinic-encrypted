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
import { jsPDF } from "jspdf";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { billingService } from "@/services/billing.service";
import { renderStatus } from "@/components/ui/StatusTag";
import { formatCurrency } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { BillingSummary, PaymentRecord, PlanRecord } from "@/utils/types";
import { APP_FULL_NAME } from "@/constants/brand";
import { BOOLEAN_FEATURE_FIELDS, CLINIC_PAGE_LABELS } from "@/constants/planFeatures";

// ─── Brand-anchored plan card gradients ──────────────────────────────
// Built entirely from the theme's primary/primary-dark tokens (via Tailwind
// opacity modifiers for lighter tints) — no hardcoded hex literals, so the
// cards automatically follow whatever the theme's primary color is set to.
const PLAN_GRADIENTS = [
  "from-primary/40 via-primary/70 to-primary",        // light → brand
  "from-primary/70 via-primary to-primary-dark",      // mid lift
  "from-primary via-primary-dark to-primary-dark/90",  // brand → deep
  "from-primary/40 via-primary to-primary-dark/90",    // soft → deep
  "from-primary via-primary-dark to-primary-dark/80",  // deepest
] as const;

// Merge the freeform "features" text list with whichever plan-tier
// feature-access toggles are actually enabled, so the card shows one
// combined "what's included" list instead of two disconnected blocks.
const combinedFeatures = (plan: PlanRecord): string[] => {
  const freeform = plan.features ?? [];
  const flags = plan.feature_flags ?? {};

  const enabledToggles = BOOLEAN_FEATURE_FIELDS
    .filter(({ key }) => !!flags[key])
    .map(({ label }) => label);

  if (flags.dedicated_clinic_page && flags.dedicated_clinic_page !== "none") {
    enabledToggles.push(`Dedicated Clinic Page (${CLINIC_PAGE_LABELS[flags.dedicated_clinic_page]})`);
  }

  return Array.from(new Set([...freeform, ...enabledToggles]));
};

const planPrice = (p: PlanRecord, period: "monthly" | "yearly"): number => {
  if (period === "yearly") return Number(p.yearly_price ?? p.price ?? 0);
  return Number(p.monthly_price ?? p.price ?? 0);
};

// ─── Invoice download helper (vector PDF via jsPDF) ──────────────────
const downloadInvoicePdf = (record: PaymentRecord) => {
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
  const statusPalette: Record<string, { bg: [number, number, number]; fg: [number, number, number] }> = {
    paid:     { bg: [236, 253, 245], fg: [15, 118, 110] },
    pending:  { bg: [254, 243, 199], fg: [146, 64, 14] },
    failed:   { bg: [254, 226, 226], fg: [153, 27, 27] },
    refunded: { bg: [224, 231, 255], fg: [55, 48, 163] },
  };
  const statusStyle = statusPalette[statusKey] || { bg: [226, 232, 240], fg: [51, 65, 85] };

  const brand: [number, number, number] = [31, 157, 139];
  const brandDark: [number, number, number] = [15, 111, 96];
  const heading: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const faint: [number, number, number] = [148, 163, 184];
  const border: [number, number, number] = [226, 232, 240];
  const surface: [number, number, number] = [248, 250, 252];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;

  // Top accent bar
  doc.setFillColor(...brand);
  doc.rect(0, 0, pageWidth, 6, "F");

  // Brand block (logo chip + name)
  doc.setFillColor(...brandDark);
  doc.roundedRect(marginX, 28, 34, 34, 8, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("M", marginX + 17, 50, { align: "center" });

  doc.setTextColor(...heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(APP_FULL_NAME, marginX + 44, 44);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("AI-POWERED CLINIC CRM", marginX + 44, 55);

  // Invoice number + status (right aligned)
  doc.setTextColor(...faint);
  doc.setFontSize(8);
  doc.text("INVOICE", pageWidth - marginX, 36, { align: "right" });
  doc.setTextColor(...heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`#${invoiceNo}`, pageWidth - marginX, 50, { align: "right" });

  const statusText = safe(record.status).toUpperCase();
  doc.setFontSize(8);
  const statusTextWidth = doc.getTextWidth(statusText);
  const pillWidth = statusTextWidth + 20;
  const pillX = pageWidth - marginX - pillWidth;
  doc.setFillColor(...statusStyle.bg);
  doc.roundedRect(pillX, 58, pillWidth, 16, 8, 8, "F");
  doc.setTextColor(...statusStyle.fg);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pillX + pillWidth / 2, 68.5, { align: "center" });

  // Billed To / Billed From boxes
  const partyTop = 92;
  const partyHeight = 62;
  const partyWidth = (contentWidth - 20) / 2;

  const drawParty = (x: number, title: string, lines: string[]) => {
    doc.setDrawColor(...border);
    doc.setFillColor(...surface);
    doc.roundedRect(x, partyTop, partyWidth, partyHeight, 8, 8, "FD");
    doc.setTextColor(...faint);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(title.toUpperCase(), x + 14, partyTop + 18);
    let y = partyTop + 32;
    lines.forEach((line, i) => {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      doc.setFontSize(i === 0 ? 10.5 : 9);
      doc.setTextColor(i === 0 ? heading[0] : muted[0], i === 0 ? heading[1] : muted[1], i === 0 ? heading[2] : muted[2]);
      doc.text(line, x + 14, y);
      y += 13;
    });
  };

  const billedToLines = [safe(record.userName ?? record.tenantName)];
  if (record.userEmail) billedToLines.push(safe(record.userEmail));
  if (record.tenantName && record.userName) billedToLines.push(safe(record.tenantName));

  drawParty(marginX, "Billed To", billedToLines);
  drawParty(marginX + partyWidth + 20, "Billed From", [APP_FULL_NAME, "support@medleads.ai", "All transactions in USD ($)"]);

  // Date row
  const dateTop = partyTop + partyHeight + 24;
  const dateColWidth = contentWidth / 3;
  const dateCells: Array<[string, string]> = [
    ["Issue Date", issueDate],
    ["Billing Period", safe(record.period)],
    ["Payment Method", safe(record.method)],
  ];
  dateCells.forEach(([label, value], i) => {
    const x = marginX + dateColWidth * i;
    doc.setDrawColor(...border);
    doc.line(x, dateTop, x + dateColWidth - 16, dateTop);
    doc.setTextColor(...faint);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x, dateTop + 14);
    doc.setTextColor(...heading);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, x, dateTop + 28);
  });

  // Items table
  const tableTop = dateTop + 48;
  const tableHeaderHeight = 26;
  const tableRowHeight = 48;
  const colWidths = [contentWidth * 0.38, contentWidth * 0.18, contentWidth * 0.28, contentWidth * 0.16];
  const colX = [
    marginX,
    marginX + colWidths[0],
    marginX + colWidths[0] + colWidths[1],
    marginX + colWidths[0] + colWidths[1] + colWidths[2],
  ];

  doc.setDrawColor(...border);
  doc.roundedRect(marginX, tableTop, contentWidth, tableHeaderHeight + tableRowHeight, 8, 8, "S");
  doc.setFillColor(...surface);
  doc.roundedRect(marginX, tableTop, contentWidth, tableHeaderHeight, 8, 8, "F");
  doc.rect(marginX, tableTop + tableHeaderHeight - 8, contentWidth, 8, "F");

  const headers = ["Description", "Period", "Transaction ID", "Amount"];
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  headers.forEach((h, i) => {
    const align = i === 3 ? "right" : "left";
    const x = i === 3 ? colX[i] + colWidths[i] - 14 : colX[i] + 14;
    doc.text(h.toUpperCase(), x, tableTop + 16, { align });
  });

  doc.setDrawColor(...border);
  doc.line(marginX, tableTop + tableHeaderHeight, marginX + contentWidth, tableTop + tableHeaderHeight);

  const rowY = tableTop + tableHeaderHeight + 20;
  doc.setTextColor(...heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(safe(record.planName), colX[0] + 14, rowY);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Subscription · ${safe(record.period) || "monthly"}`, colX[0] + 14, rowY + 12);

  doc.setTextColor(...muted);
  doc.setFontSize(9.5);
  doc.text(safe(record.period), colX[1] + 14, rowY);

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.text(safe(record.transactionId), colX[2] + 14, rowY);

  doc.setTextColor(...heading);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(fmt(amount), colX[3] + colWidths[3] - 14, rowY, { align: "right" });

  // Totals box
  const totalsTop = tableTop + tableHeaderHeight + tableRowHeight + 20;
  const totalsWidth = 220;
  const totalsX = pageWidth - marginX - totalsWidth;
  const totalsHeight = 84;

  doc.setDrawColor(...border);
  doc.setFillColor(...surface);
  doc.roundedRect(totalsX, totalsTop, totalsWidth, totalsHeight, 8, 8, "FD");

  const totalsRow = (label: string, value: string, y: number, grand = false) => {
    doc.setFont("helvetica", grand ? "bold" : "normal");
    doc.setFontSize(grand ? 11.5 : 9.5);
    doc.setTextColor(grand ? heading[0] : muted[0], grand ? heading[1] : muted[1], grand ? heading[2] : muted[2]);
    doc.text(label, totalsX + 16, y);
    if (grand) {
      doc.setTextColor(...brand);
      doc.setFontSize(13);
    }
    doc.text(value, totalsX + totalsWidth - 16, y, { align: "right" });
  };

  totalsRow("Subtotal", fmt(subtotal), totalsTop + 22);
  totalsRow("Tax", fmt(tax), totalsTop + 40);
  doc.setDrawColor(...border);
  doc.line(totalsX + 16, totalsTop + 50, totalsX + totalsWidth - 16, totalsTop + 50);
  totalsRow("Total Due", fmt(total), totalsTop + 70, true);

  // Thank-you note
  const thanksTop = totalsTop + totalsHeight + 24;
  doc.setFillColor(240, 249, 247);
  doc.setDrawColor(brand[0], brand[1], brand[2]);
  doc.roundedRect(marginX, thanksTop, contentWidth, 32, 8, 8, "FD");
  doc.setTextColor(...brandDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Thank you for your business. This invoice is computer-generated and does not require a signature.", marginX + 14, thanksTop + 20);

  // Footer
  const footerTop = thanksTop + 56;
  doc.setDrawColor(...border);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(marginX, footerTop, pageWidth - marginX, footerTop);
  doc.setLineDashPattern([], 0);
  doc.setTextColor(...faint);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Generated by ${APP_FULL_NAME}`, marginX, footerTop + 16);
  doc.text("Need help? support@medleads.ai", pageWidth - marginX, footerTop + 16, { align: "right" });

  doc.save(`invoice-${invoiceNo}.pdf`);
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

  const kpis = [
    { label: "Monthly Spend", value: summary?.monthlySpend ?? "—", icon: CreditCard, iconColor: "!text-emerald-500", iconBg: "bg-emerald-50" },
    { label: "Next Renewal",  value: summary?.renewalDate ?? "—",  icon: Calendar,   iconColor: "!text-violet-500",  iconBg: "bg-violet-50"  },
    { label: "Current Plan",  value: summary?.currentPlan ?? "—",  icon: Zap,        iconColor: "!text-amber-500",   iconBg: "bg-amber-50"   },
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
                      <h4 className="mt-0.5 text-xl font-bold leading-tight !text-white">{plan.name}</h4>
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
                      {combinedFeatures(plan).length === 0 && (
                        <li className="text-xs text-slate-400">No features listed.</li>
                      )}
                      {combinedFeatures(plan).map((f, i) => (
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
              onClick={() => downloadInvoicePdf(record)}
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
