"use client";

import { Banknote, CalendarCheck, CheckCircle2, Users, UserPlus, Zap, type LucideIcon } from "lucide-react";
import type { DashboardMetric } from "../utils/types";

function getIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("revenue") || l.includes("mrr") || l.includes("payment")) return Banknote;
  if (l.includes("lead")) return UserPlus;
  if (l.includes("book") || l.includes("won") || l.includes("appoint") || l.includes("schedule")) return CalendarCheck;
  if (l.includes("ticket") || l.includes("support") || l.includes("resolved")) return CheckCircle2;
  if (l.includes("ai") || l.includes("chat") || l.includes("message")) return Zap;
  return Users;
}

export const KpiCard = ({ metric }: { metric: DashboardMetric; index?: number }) => {
  const Icon = getIcon(metric.label);
  const isDown = metric.trend === "down";
  const changeMatch = metric.change.match(/[+\-]?\d+(\.\d+)?%?/);
  const changeDisplay = changeMatch ? changeMatch[0] : metric.change;
  const hasPlus = !isDown && !changeDisplay.startsWith("+") && !changeDisplay.startsWith("-");

  return (
    <div className="group relative isolate overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,55,59,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_24px_rgba(15,55,59,0.12)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3e9baa] via-[#75c8ca] to-[#d5eff0]" />
      <div className="relative px-5 pb-4 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase leading-5 tracking-[0.08em] text-slate-400">{metric.label}</p>
            <span className="mt-1 block h-px w-7 bg-[#74c4c7]" />
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#28666b] to-[#17494e] shadow-[0_5px_10px_rgba(31,85,89,0.22)] ring-1 ring-white/30">
            <Icon size={20} strokeWidth={1.9} className="text-white" />
          </div>
        </div>

        <p className="mt-3 text-[27px] font-bold leading-8 tracking-[-0.03em] text-[#1b5459] tabular-nums">
          {metric.value}
        </p>
      </div>

      <div
        className={`flex min-h-12 items-center gap-2.5 border-t px-5 text-[11px] font-bold ${
          isDown ? "border-rose-100 bg-rose-50 text-rose-600" : "border-[#c9e8e9] bg-[#e8f7f7] text-[#39777d]"
        }`}
      >
        <span className="flex h-6 w-8 shrink-0 items-center text-current">
          <svg viewBox="0 0 38 24" className="h-5 w-8" aria-hidden="true">
            {isDown ? (
              <>
                <rect x="1" y="1" width="3.5" height="22" rx="1" fill="currentColor" />
                <rect x="7" y="4" width="3.5" height="19" rx="1" fill="currentColor" />
                <rect x="13" y="3" width="3.5" height="20" rx="1" fill="currentColor" />
                <rect x="19" y="9" width="3.5" height="14" rx="1" fill="currentColor" />
                <rect x="25" y="11" width="3.5" height="12" rx="1" fill="currentColor" />
                <rect x="31" y="16" width="3.5" height="7" rx="1" fill="currentColor" />
              </>
            ) : (
              <>
                <rect x="1" y="16" width="3.5" height="7" rx="1" fill="currentColor" />
                <rect x="7" y="11" width="3.5" height="12" rx="1" fill="currentColor" />
                <rect x="13" y="9" width="3.5" height="14" rx="1" fill="currentColor" />
                <rect x="19" y="3" width="3.5" height="20" rx="1" fill="currentColor" />
                <rect x="25" y="4" width="3.5" height="19" rx="1" fill="currentColor" />
                <rect x="31" y="1" width="3.5" height="22" rx="1" fill="currentColor" />
              </>
            )}
          </svg>
        </span>
        <span>{hasPlus ? `+${changeDisplay}` : changeDisplay} vs. yesterday</span>
      </div>
    </div>
  );
};
