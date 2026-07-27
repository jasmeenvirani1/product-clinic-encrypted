"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Stethoscope, Zap } from "lucide-react";

const INCLUDED_HIGHLIGHTS = [
  "Customize any master speciality's content and SEO fields for your clinic",
  "Add wholly new specialities scoped only to your clinic",
  "Revert to the default master content at any time",
];

/**
 * Locked/upsell state shown on `/app/specialities` when the tenant's plan does
 * not include the `specialities` feature flag. Self-contained — reads nothing
 * from props, just renders the upsell card and a CTA to the billing page.
 * Visual language borrowed from billing page's gradient plan cards and
 * PlanExpiredBanner's CTA idiom (not copied wholesale).
 */
export function SpecialitiesLockedState() {
  const router = useRouter();

  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Gradient header, matches billing page's PLAN_GRADIENTS treatment */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/70 via-primary to-primary-dark px-6 pb-8 pt-6 text-white">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 p-2.5 ring-1 ring-white/30">
                <Stethoscope size={22} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/85">
                  Specialities
                </p>
                <h2 className="mt-0.5 text-xl font-bold leading-tight !text-white">
                  Not included in your plan
                </h2>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/30">
              <Lock size={10} /> Locked
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6">
          <p className="text-sm text-slate-600">
            Upgrade your plan to customize the master list of specialities for your clinic —
            override content and SEO fields, add your own specialities, and revert to defaults
            whenever you like.
          </p>

          <ul className="space-y-2">
            {INCLUDED_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-slate-700">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => router.push("/app/billing")}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          >
            <Zap size={14} strokeWidth={2.5} />
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
