"use client";

import { Timeline } from "antd";
import { PageSection } from "@/components/PageSection";

export default function AutomationPage() {
  return (
    <div className="">
      <PageSection eyebrow="Clinic CRM" title="Automation" description="Read-only workflow activity log for AI and routing automations." />
      <div className="crm-card p-6">
        <Timeline
          items={[
            { color: "blue", children: "09:22 - AI qualified a WhatsApp lead and routed it to Sarah." },
            { color: "green", children: "08:57 - Campaign sync updated Instagram tags for UK segment." },
            { color: "orange", children: "08:31 - Human handoff triggered after low confidence response." },
            { color: "purple", children: "07:48 - Web chat widget created a new lead automatically." },
          ]}
        />
      </div>
    </div>
  );
}
