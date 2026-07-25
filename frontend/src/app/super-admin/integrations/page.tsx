"use client";

import { Card } from "antd";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import { renderStatus } from "@/components/ui/StatusTag";
import { AppSwitch } from "@/components/ui/AppSwitch";
import type { IntegrationKey } from "@/utils/types";

export default function SuperAdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationKey[]>([]);

  useEffect(() => {
    void superadminService.getIntegrations().then(setIntegrations);
  }, []);

  return (
    <div className="">
      <PageSection eyebrow="Super Admin" title="Global integrations" description="Manage platform keys and provider connectivity." />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTable
          cardTitle="Global keys"
          rowKey="id"
          dataSource={integrations}
          columns={[
            { title: "Provider", dataIndex: "provider" },
            { title: "Key Preview", dataIndex: "keyPreview" },
            { title: "Status", dataIndex: "status", render: renderStatus },
          ]}
        />
        <Card className="crm-card">
          <h3 className="text-lg font-semibold text-slate-900">Connection policies</h3>
          <div className="mt-4 space-y-4">
            <div className="crm-toggle-row flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span>Rotate API keys automatically</span>
              <AppSwitch defaultChecked />
            </div>
            <div className="crm-toggle-row flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span>Allow tenant-level overrides</span>
              <AppSwitch defaultChecked />
            </div>
            <div className="crm-toggle-row flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span>Send alert on provider outage</span>
              <AppSwitch defaultChecked />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
