import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME, COPYRIGHT_YEAR } from "@/constants/brand";
import { LogoMark } from "@/components/LogoMark";

const highlights = [
  "Role-based CRM for clinics, teams & AI agents",
  "Live conversation inbox with AI handoff",
  "Campaign tracking & revenue visibility",
  "Multi-tenant platform with per-clinic workspaces",
];

const stats = [
  { label: "Tenants",           value: "128+" },
  { label: "AI Sessions / mo.", value: "48K" },
  { label: "Conversion lift",   value: "+19%" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex">
      {/* ─── Left panel ─── */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[50%] flex-col justify-between bg-primary px-12 py-14 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <LogoMark size="md" className="shadow" />
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        {/* Headline */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-white">
              The CRM built for <br />
              clinic growth teams.
            </h1>
            <p className="mt-4 text-base text-sky-200 leading-relaxed max-w-sm">
              Manage leads, run AI-powered conversations, and track revenue — all from one polished workspace.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-3 text-sm text-sky-100">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sky-300" />
                {h}
              </li>
            ))}
          </ul>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 px-4 py-3">
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="mt-0.5 text-xs text-sky-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-sky-300">© {COPYRIGHT_YEAR} {APP_NAME} · All rights reserved</p>
      </div>

      {/* ─── Right panel (form) — the only scrollable region ─── */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-[580px] my-auto">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <LogoMark size="sm" className="shadow" />
            <span className="text-base font-semibold text-slate-800">{APP_NAME}</span>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
