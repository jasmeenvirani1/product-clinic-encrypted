"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSection } from "@/components/PageSection";

// Retired — Settings has been renamed to Profile.
// Kept as a thin redirect so old links/bookmarks to /app/settings
// still land somewhere useful instead of 404ing.
export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/profile");
  }, [router]);

  return (
    <div className="">
      <PageSection
        eyebrow="Clinic CRM"
        title="Settings"
        description="This page has moved to Profile."
      />
      <div className="py-12 text-center text-sm text-slate-400">Redirecting to Profile…</div>
    </div>
  );
}
