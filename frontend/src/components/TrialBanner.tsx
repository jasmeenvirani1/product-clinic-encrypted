"use client";

import { useRouter } from "next/navigation";
import { Zap, Clock } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function TrialBanner() {
  const { user } = useCurrentUser();
  const router = useRouter();

  if (!user?.isOnTrial) return null;

  const days = user.trialDaysLeft ?? 0;
  const isUrgent = days <= 3;
  const isWarning = days <= 7;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-6 py-2.5 text-sm font-medium ${
        isUrgent
          ? "bg-red-500 text-white"
          : isWarning
          ? "bg-amber-400 text-amber-900"
          : "bg-primary text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock size={14} className="shrink-0" />
        <span>
          {days <= 0
            ? "Your free trial has ended."
            : days === 1
            ? "Last day of your free trial!"
            : `${days} days left in your free trial.`}
        </span>
      </div>

      <button
        onClick={() => router.push("/app/billing")}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all hover:opacity-90 active:scale-95 ${
          isUrgent
            ? "bg-white text-red-500"
            : isWarning
            ? "bg-amber-900/15 text-amber-900 hover:bg-amber-900/25"
            : "bg-white/20 text-white hover:bg-white/30"
        }`}
      >
        <Zap size={11} strokeWidth={2.5} />
        Upgrade Now
      </button>
    </div>
  );
}
