"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Card, Form, Input, Modal, Segmented, Select, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { GripVertical } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { SourceLabel, SourceTag } from "@/components/SourceBadge";
import { leadsService } from "@/services/leads.service";
import { userService } from "@/services/user.service";
import type { Lead } from "@/utils/types";
import type { User } from "@/types/user.types";

type ViewMode = "card" | "list";
type StageValue = Lead["stage"] | "all";

const STAGE_OPTIONS = ["new", "qualified", "discussion", "won", "lost"] as const;

const STAGE_COLOR: Record<Lead["stage"], string> = {
  new: "blue",
  qualified: "cyan",
  discussion: "orange",
  won: "green",
  lost: "red",
};

export default function SuperAdminLeadsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tenantAdmins, setTenantAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [tenantFilter, setTenantFilter] = useState<number | "all">("all");
  const [stageFilter, setStageFilter] = useState<StageValue>("all");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostSubmitting, setLostSubmitting] = useState(false);
  const [lostTargetLeadId, setLostTargetLeadId] = useState<string | null>(null);

  // Initial load: fetch tenant admins once
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const usersRes = await userService.getTenantAdmins();
        setTenantAdmins(usersRes.data ?? []);
      } catch {
        void message.error("Failed to load tenants.");
      }
    };
    void loadTenants();
  }, [message]);

  // Re-fetch leads whenever the tenant filter changes
  useEffect(() => {
    const loadLeads = async () => {
      setLoading(true);
      try {
        const tenantId = tenantFilter !== "all" ? tenantFilter : undefined;
        const leadsRes = await leadsService.getAll(tenantId);
        setLeads(leadsRes.data ?? []);
      } catch {
        void message.error("Failed to load leads.");
      } finally {
        setLoading(false);
      }
    };
    void loadLeads();
  }, [tenantFilter, message]);

  const tenantMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const user of tenantAdmins) {
      if (user.id) {
        map.set(parseInt(user.id), user.clinic_name || user.full_name || user.email);
      }
    }
    return map;
  }, [tenantAdmins]);

  const tenantOptions = useMemo(
    () => [
      { value: "all" as const, label: "All Tenants" },
      ...tenantAdmins.map((u) => ({
        value: parseInt(u.id),
        label: u.clinic_name || u.full_name || u.email,
      })),
    ],
    [tenantAdmins]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      // Tenant filtering is done server-side; only apply stage and search filters here
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (!q) return true;
      return [lead.name, lead.source, lead.city, lead.email, lead.phone].some(
        (v) => v && v.toLowerCase().includes(q)
      );
    });
  }, [leads, stageFilter, searchQuery]);

  const leadsByStage = useMemo(() => {
    return STAGE_OPTIONS.reduce<Record<Lead["stage"], Lead[]>>(
      (acc, stage) => {
        acc[stage] = filtered.filter((lead) => lead.stage === stage);
        return acc;
      },
      {
        new: [],
        qualified: [],
        discussion: [],
        won: [],
        lost: [],
      }
    );
  }, [filtered]);

  const handleStageDrop = async (targetStage: Lead["stage"]) => {
    if (!draggingLeadId) return;

    const lead = leads.find((item) => item.id === draggingLeadId);
    setDraggingLeadId(null);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === "lost") {
      setLostTargetLeadId(lead.id);
      form.setFieldsValue({ lost_remark: lead.remark ?? undefined });
      setLostModalOpen(true);
      return;
    }

    const previousStage = lead.stage;
    setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, stage: targetStage } : item)));

    try {
      await leadsService.updateLeadStage(lead.id, targetStage);
      void message.success(`Moved to ${targetStage}.`);
    } catch {
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, stage: previousStage } : item)));
      void message.error("Failed to update lead stage.");
    }
  };

  const handleConfirmLost = async () => {
    if (!lostTargetLeadId) return;

    try {
      const values = await form.validateFields();
      const remark = (values.lost_remark as string).trim();
      const lead = leads.find((item) => item.id === lostTargetLeadId);
      if (!lead) {
        setLostModalOpen(false);
        setLostTargetLeadId(null);
        return;
      }

      const previousStage = lead.stage;
      const previousRemark = lead.remark;
      setLostSubmitting(true);

      setLeads((prev) =>
        prev.map((item) =>
          item.id === lostTargetLeadId ? { ...item, stage: "lost", remark } : item
        )
      );

      try {
        await leadsService.update(lostTargetLeadId, { stage: "lost", remark });
        void message.success("Moved to lost.");
        setLostModalOpen(false);
        setLostTargetLeadId(null);
        form.resetFields();
      } catch {
        setLeads((prev) =>
          prev.map((item) =>
            item.id === lostTargetLeadId
              ? { ...item, stage: previousStage, remark: previousRemark ?? null }
              : item
          )
        );
        void message.error("Failed to update lead stage.");
      }
    } finally {
      setLostSubmitting(false);
    }
  };

  const columns: ColumnsType<Lead> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (value: string, record: Lead) => (
        <div>
          <div className="font-medium">{value}</div>
        </div>
      ),
    },
    {
      title: "Clinic",
      dataIndex: "tenant_id",
      render: (id: number | null) =>
        id && tenantMap.get(id) ? <Tag color="blue">{tenantMap.get(id)}</Tag> : <span className="text-slate-400">-</span>,
    },
    {
      title: "Source",
      dataIndex: "source",
      render: (v: string | null) => v ? <SourceLabel source={v} /> : <span className="text-slate-400">-</span>,
    },
    { title: "City", dataIndex: "city", render: (v: string | null) => v ?? "-" },
    { title: "Phone", dataIndex: "phone", render: (v: string | null) => v ?? "-" },
    {
      title: "Score",
      dataIndex: "score",
      render: (value: number) => (
        <Tag color={value >= 80 ? "green" : value >= 60 ? "cyan" : "gold"}>{value}</Tag>
      ),
    },
    {
      title: "Stage",
      dataIndex: "stage",
      render: (stage: Lead["stage"]) => <Tag color={STAGE_COLOR[stage]}>{stage}</Tag>,
    },
    {
      title: "Assigned To",
      dataIndex: "AssignedUser",
      render: (user: Lead["AssignedUser"]) =>
        user ? <span className="text-sm">{user.full_name}</span> : <span className="text-slate-400">Unassigned</span>,
    },
  ];

  return (
    <div>
      <PageSection
        eyebrow="Super Admin"
        title="Clinic Leads"
        description="View and manage leads across all clinic tenants."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Space size={8} wrap>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { label: "Card View", value: "card" },
              { label: "List View", value: "list" },
            ]}
          />
          <Select
            value={tenantFilter}
            onChange={(value) => setTenantFilter(value)}
            style={{ width: 220 }}
            options={tenantOptions}
            showSearch
            optionFilterProp="label"
            placeholder="All Tenants"
          />
          {viewMode === "list" && (
            <Select
              value={stageFilter}
              onChange={(value) => setStageFilter(value)}
              style={{ width: 160 }}
              options={[
                { value: "all", label: "All Stages" },
                ...STAGE_OPTIONS.map((stage) => ({ value: stage, label: stage })),
              ]}
            />
          )}
        </Space>
        <Input.Search
          placeholder="Search leads..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          className="w-72"
        />
      </div>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGE_OPTIONS.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleStageDrop(stage)}
              className="min-h-[380px] rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-sm font-semibold capitalize text-slate-700">{stage}</span>
                <Tag color={STAGE_COLOR[stage]}>{leadsByStage[stage].length}</Tag>
              </div>

              <div className="space-y-3">
                {leadsByStage[stage].map((lead) => (
                  <Card
                    key={lead.id}
                    size="small"
                    draggable
                    onDragStart={() => setDraggingLeadId(lead.id)}
                    onDragEnd={() => setDraggingLeadId(null)}
                    className="cursor-grab rounded-lg border border-slate-200"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-800">{lead.name}</div>
                      </div>
                      <GripVertical size={14} className="text-slate-400" />
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1">
                      {lead.tenant_id && tenantMap.get(lead.tenant_id) && <Tag color="blue">{tenantMap.get(lead.tenant_id)}</Tag>}
                      {lead.source && <SourceTag source={lead.source} />}
                      <Tag color={lead.score >= 80 ? "green" : lead.score >= 60 ? "cyan" : "gold"}>
                        Score {lead.score}
                      </Tag>
                    </div>

                    <div className="text-xs text-slate-500">{lead.AssignedUser?.full_name ?? "Unassigned"}</div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable rowKey="id" loading={loading} dataSource={filtered} columns={columns} />
      )}

      <Modal
        title="Mark Lead as Lost"
        open={lostModalOpen}
        onCancel={() => {
          setLostModalOpen(false);
          setLostTargetLeadId(null);
          form.resetFields();
        }}
        onOk={() => void handleConfirmLost()}
        okText="Save"
        confirmLoading={lostSubmitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="lost_remark"
            label="Remark"
            rules={[
              { required: true, message: "Remark is required when stage is lost." },
              { max: 500, message: "Remark must be 500 characters or fewer." },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Please add the reason for marking this lead as lost."
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
