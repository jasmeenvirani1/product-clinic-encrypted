"use client";

import { useEffect, useState } from "react";
import { Button } from "antd";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { billingService } from "@/services/billing.service";

type Status = "confirming" | "success" | "cancelled" | "error";

export default function PaymentConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("confirming");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const stripeStatus = params.get("stripe_status");
      const sessionId = params.get("session_id");

      if (stripeStatus === "cancelled") {
        setStatus("cancelled");
        return;
      }

      if (stripeStatus === "success" && sessionId) {
        try {
          await billingService.confirmStripeCheckoutSession(sessionId);
          setStatus("success");
          // Brief pause so the user sees the success state, then move on
          setTimeout(() => router.push("/onboarding"), 1800);
        } catch (err: unknown) {
          const e = err as { response?: { data?: { message?: string } } };
          setErrorMsg(e?.response?.data?.message ?? "Payment verification failed.");
          setStatus("error");
        }
        return;
      }

      // Unexpected — send back to select-plan
      router.replace("/onboarding/select-plan");
    };

    void run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {status === "confirming" && (
        <div className="space-y-4">
          <Loader2 size={40} className="mx-auto animate-spin text-emerald-500" />
          <p className="text-base font-medium text-slate-700">Confirming your payment…</p>
          <p className="text-sm text-slate-400">Please wait, this only takes a moment.</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
          <p className="text-xl font-bold text-slate-900">Payment confirmed!</p>
          <p className="text-sm text-slate-500">Your plan is now active. Setting up your workspace…</p>
        </div>
      )}

      {status === "cancelled" && (
        <div className="space-y-4">
          <XCircle size={48} className="mx-auto text-slate-400" />
          <p className="text-xl font-bold text-slate-900">Payment cancelled</p>
          <p className="text-sm text-slate-500">No charge was made. You can try again or skip for now.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={() => router.push("/onboarding/select-plan")}>Try again</Button>
            <Button type="primary" onClick={() => router.push("/onboarding")}>Continue without plan</Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <XCircle size={48} className="mx-auto text-rose-400" />
          <p className="text-xl font-bold text-slate-900">Verification failed</p>
          <p className="text-sm text-slate-500">{errorMsg || "We could not verify your payment. Please contact support."}</p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={() => router.push("/onboarding/select-plan")}>Back to plans</Button>
            <Button type="primary" onClick={() => router.push("/onboarding")}>Continue setup</Button>
          </div>
        </div>
      )}
    </div>
  );
}
