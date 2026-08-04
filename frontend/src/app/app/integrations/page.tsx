"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSection } from "@/components/PageSection";

// Retired — Integrations has been consolidated into App Connections.
// Kept as a thin redirect so old links/bookmarks to /app/integrations
// still land somewhere useful instead of 404ing.
export default function IntegrationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/connections");
  }, [router]);

  return (
    <div className="">
      <PageSection
        eyebrow="Clinic CRM"
        title="Integrations"
        description="This page has moved to App Connections."
      />
      <div className="py-12 text-center text-sm text-slate-400">Redirecting to App Connections…</div>
    </div>
  );
}
