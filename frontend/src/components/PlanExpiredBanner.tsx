"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Zap } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function PlanExpiredBanner() {
  const { user } = useCurrentUser();
  const router = useRouter();

  if (!user?.isPlanExpired) return null;

  return (
    <div className="flex items-center justify-between gap-4 bg-red-500 px-6 py-2.5 text-sm font-medium text-white">
      <div className="flex items-center gap-2">
        <AlertCircle size={14} className="shrink-0" />
        <span>
          {user.isOnTrial === false && !user.trialEndsAt
            ? "Your plan has expired. Renew now to restore full access."
            : "Your free trial has expired. Subscribe to continue using all features."}
        </span>
      </div>

      <button
        onClick={() => router.push("/app/billing")}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-semibold text-red-500 transition-all hover:opacity-90 active:scale-95"
      >
        <Zap size={11} strokeWidth={2.5} />
        Renew Now
      </button>
    </div>
  );
}
