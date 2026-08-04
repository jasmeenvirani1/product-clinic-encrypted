"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LandingFaqRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/super-admin/landing-page?tab=faq");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-slate-400" />
    </div>
  );
}
