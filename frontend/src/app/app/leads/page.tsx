"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { GripVertical, History, Plus, SquarePen, SlidersHorizontal, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { SOURCE_OPTIONS, SourceLabel, SourceTag } from "@/components/SourceBadge";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  createLeadThunk,
  deleteLeadThunk,
  fetchLeads,
  patchLead,
  regenerateSummaryThunk,
  updateLeadStageThunk,
  updateLeadThunk,
} from "@/store/slices/leadsSlice";
import { leadsService } from "@/services/leads.service";
import { customFieldsService } from "@/services/customFields.service";
import { fieldPreferencesService } from "@/services/fieldPreferences.service";
import type { CustomField } from "@/types/customField.types";
import type { Lead } from "@/utils/types";

type ViewMode = "card" | "list";
type StageValue = Lead["stage"] | "all";

const STAGE_OPTIONS = ["new", "qualified", "discussion", "won", "lost"] as const;
const STAGE_SCORE_MAP: any = {
  new: 10,
  qualified: 25,
  discussion: 55,
  won: 85,
  lost: 5,
};

const STAGE_COLOR: Record<Lead["stage"], string> = {
  new: "blue",
  qualified: "cyan",
  discussion: "orange",
  won: "green",
  lost: "red",
};

type Teammate = { id: number; full_name: string; email: string };

export default function LeadsPage() {
  const { message, modal } = App.useApp();
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();

  const leads = useAppSelector((state) => state.leads.items);
  const status = useAppSelector((state) => state.leads.status);
  const currentUser = useAppSelector((state) => state.auth.user);

  const isAdmin = currentUser?.role === "super_admin" || currentUser?.role === "tenant_admin";

  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [stageFilter, setStageFilter] = useState<StageValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [summaryHistory, setSummaryHistory] = useState<{ id: number; summary: string; stage: string; score: number; intent: string; createdAt: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customFields, setCustomFields]     = useState<CustomField[]>([]);
  const [hiddenFields, setHiddenFields]     = useState<string[]>([]);
  const [colDrawerOpen, setColDrawerOpen]   = useState(false);
  const [savingPrefs, setSavingPrefs]       = useState(false);
  const selectedStage = Form.useWatch("stage", form);

  const loading = status === "loading";

  useEffect(() => {
    if (!selectedStage) return;
    const expectedScore = STAGE_SCORE_MAP[selectedStage];
    if (form.getFieldValue("score") !== expectedScore) {
      form.setFieldValue("score", expectedScore);
    }
  }, [form, selectedStage]);

  useEffect(() => {
    void dispatch(fetchLeads());
    if (isAdmin) {
      leadsService
        .getTeammates()
        .then(setTeammates)
        .catch(() => void message.error("Failed to load team members."));
    }
    // Load active custom field definitions and this tenant's hidden column preferences
    customFieldsService.getPublic("leads")
      .then(setCustomFields)
      .catch(() => {});
    fieldPreferencesService.get("leads")
      .then(setHiddenFields)
      .catch(() => {});
  }, [dispatch, isAdmin, message]);

  const teammateOptions = teammates.map((t) => ({
    value: t.id,
    label: `${t.full_name} (${t.email})`,
  }));

  const visibleLeads = useMemo(() => {
    const uid = currentUser ? Number(currentUser.id) : null;
    if (currentUser?.role === "super_admin") return leads;
    if (currentUser?.role === "tenant_admin") {
      if (!uid) return [];
      return leads.filter((l) => l.created_by === uid);
    }
    if (!uid) return leads;
    return leads.filter((l) => l.assigned_to === uid || l.created_by === uid);
  }, [leads, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleLeads.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (!q) return true;
      return [l.name, l.source, l.city, l.email, l.phone].some(
        (v) => v && v.toLowerCase().includes(q)
      );
    });
  }, [visibleLeads, query, stageFilter]);

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

  const openCreateModal = () => {
    setEditingLead(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (lead: Lead, forcedStage?: Lead["stage"]) => {
    const stageValue = forcedStage ?? lead.stage;
    setEditingLead(lead);
    form.setFieldsValue({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      stage: stageValue,
      city: lead.city,
      score: STAGE_SCORE_MAP[stageValue],
      notes: lead.notes,
      lost_remark: stageValue === "lost" ? (lead.remark ?? undefined) : undefined,
      assigned_to: lead.assigned_to,
      custom_data: lead.custom_data ?? {},
    });
    setModalOpen(true);
  };

  const handleStageChange = async (lead: Lead, nextStage: Lead["stage"]) => {
    if (lead.stage === "won") {
      void message.warning("Won leads cannot be moved to another stage.");
      return;
    }
    if (nextStage === "lost") {
      openEditModal(lead, "lost");
      return;
    }
    try {
      await dispatch(updateLeadStageThunk({ leadId: lead.id, stage: nextStage })).unwrap();
    } catch (err: unknown) {
      void message.error(typeof err === "string" ? err : "Failed to update stage.");
    }
  };

  const handleDropToStage = async (targetStage: Lead["stage"]) => {
    if (!draggingLeadId) return;
    const lead = visibleLeads.find((item) => item.id === draggingLeadId);
    setDraggingLeadId(null);
    if (!lead || lead.stage === targetStage) return;
    await handleStageChange(lead, targetStage);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const { lost_remark, custom_data, ...payload } = values as typeof values & { lost_remark?: string; custom_data?: Record<string, unknown> };
      payload.score = STAGE_SCORE_MAP[payload.stage];
      if (custom_data) (payload as Record<string, unknown>).custom_data = custom_data;

      if (payload.stage === "lost") {
        payload.remark = lost_remark?.trim() || null;
      }

      if (!isAdmin) {
        delete payload.assigned_to;
      }

      if (editingLead) {
        if (editingLead.stage === "won" && payload.stage !== "won") {
          void message.warning("Won leads cannot be moved to another stage.");
          return;
        }
        const prevStage = editingLead.stage;
        await dispatch(updateLeadThunk({ id: editingLead.id, payload })).unwrap();
        void message.success("Lead updated.");
        if (payload.stage && prevStage !== payload.stage) {
          void handleRegenerateSummary(editingLead);
        }
      } else {
        await dispatch(createLeadThunk(payload)).unwrap();
        void message.success("Lead created.");
      }

      setModalOpen(false);
      form.resetFields();
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown[] })?.errorFields) {
        void message.error("Please fix the highlighted form errors.");
      } else {
        const msg =
          typeof err === "string"
            ? err
            : (err as { message?: string })?.message ?? "Failed to save lead.";
        void message.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const openSummaryHistory = async (lead: Lead) => {
    setHistoryLead(lead);
    setSummaryHistory([]);
    setHistoryLoading(true);
    try {
      const data = await leadsService.getSummaries(lead.id);
      setSummaryHistory(data);
      // Patch the card in Redux with the latest summary so it shows without a full refresh
      if (data.length > 0 && data[0].summary) {
        dispatch(patchLead({ id: lead.id, ai_summary: data[0].summary }));
      }
    } catch {
      void message.error("Failed to load summary history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRegenerateSummary = async (lead: Lead) => {
    setRegeneratingId(lead.id);
    try {
      const updated = await dispatch(regenerateSummaryThunk(lead.id)).unwrap();
      if (updated?.ai_summary) {
        dispatch(patchLead({ id: lead.id, ai_summary: updated.ai_summary }));
      }
      void message.success("Summary regenerated.");
    } catch {
      void message.error("Failed to regenerate summary.");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = (lead: Lead) => {
    modal.confirm({
      title: `Delete "${lead.name}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await dispatch(deleteLeadThunk(lead.id)).unwrap();
          void message.success("Lead deleted.");
        } catch (err: unknown) {
          void message.error(typeof err === "string" ? err : "Failed to delete lead.");
        }
      },
    });
  };

  // ─── Built-in column definitions (each with a stable string key) ──────────
  const BUILT_IN_COL_DEFS = useMemo(() => [
    { key: "name",        label: "Name" },
    { key: "source",      label: "Source" },
    { key: "city",        label: "City" },
    { key: "phone",       label: "Phone" },
    { key: "score",       label: "Score" },
    { key: "stage",       label: "Stage" },
    { key: "assigned_to", label: "Assigned To" },
  ], []);

  // ─── Column picker: all toggleable columns ────────────────────────────────
  const allColumnDefs = useMemo(() => [
    ...BUILT_IN_COL_DEFS,
    ...customFields.map((f) => ({ key: `custom_${f.field_key}`, label: f.label })),
  ], [BUILT_IN_COL_DEFS, customFields]);

  const visibleKeys = useMemo(
    () => allColumnDefs.map((c) => c.key).filter((k) => !hiddenFields.includes(k)),
    [allColumnDefs, hiddenFields]
  );

  const savePrefs = useCallback(async (keys: string[]) => {
    setSavingPrefs(true);
    try {
      await fieldPreferencesService.save("leads", keys);
      void message.success("Column preferences saved.");
    } catch {
      void message.error("Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  }, [message]);

  // ─── Render helper for custom field values ────────────────────────────────
  const renderCustomValue = (field: CustomField, val: unknown) => {
    if (val === undefined || val === null || val === "") return <span className="text-slate-400">-</span>;
    if (field.field_type === "boolean") return <Tag color={val ? "green" : "default"}>{val ? "Yes" : "No"}</Tag>;
    if (field.field_type === "date" && typeof val === "string") {
      return new Date(val).toLocaleDateString("en-IN");
    }
    return <span>{String(val)}</span>;
  };

  // ─── Render helper for custom field form inputs ───────────────────────────
  const renderCustomInput = (field: CustomField) => {
    if (field.field_type === "number")  return <InputNumber className="w-full" />;
    if (field.field_type === "date")    return <Input type="date" className="w-full" />;
    if (field.field_type === "boolean") return <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />;
    if (field.field_type === "select")  return (
      <Select options={(field.options ?? []).map((o) => ({ value: o, label: o }))} allowClear />
    );
    return <Input />;
  };

  // ─── Merged column definitions ────────────────────────────────────────────
  const columns: ColumnsType<Lead> = useMemo(() => {
    const builtIn: ColumnsType<Lead> = [
      {
        key: "name",
        title: "Name",
        dataIndex: "name",
        render: (value: string) => <div className="font-medium">{value}</div>,
      },
      {
        key: "source",
        title: "Source",
        dataIndex: "source",
        render: (v: string | null) => v ? <SourceLabel source={v} /> : <span className="text-slate-400">-</span>,
      },
      { key: "city", title: "City", dataIndex: "city", render: (v: string | null) => v ?? "-" },
      {
        key: "phone",
        title: "Phone",
        dataIndex: "phone",
        render: (v: string | null) => {
          if (!v) return "-";
          return (
            <Tooltip title="Copy">
              <span className="cursor-pointer hover:text-blue-500 transition-colors" onClick={() => navigator.clipboard.writeText(v)}>
                {v}
              </span>
            </Tooltip>
          );
        },
      },
      {
        key: "score",
        title: "Score",
        dataIndex: "score",
        render: (value: number) => (
          <Tag color={value >= 80 ? "green" : value >= 50 ? "blue" : value >= 20 ? "gold" : "red"}>
            {value >= 80 ? "HOT" : value >= 50 ? "High" : value >= 20 ? "Medium" : "Low"} {value}
          </Tag>
        ),
      },
      {
        key: "stage",
        title: "Stage",
        dataIndex: "stage",
        render: (stage: Lead["stage"], record: Lead) => (
          <Select
            value={stage}
            size="small"
            style={{ minWidth: 110 }}
            disabled={stage === "won"}
            options={STAGE_OPTIONS.map((v) => ({ value: v, label: v }))}
            onChange={(value) => void handleStageChange(record, value)}
          />
        ),
      },
      {
        key: "assigned_to",
        title: "Assigned To",
        dataIndex: "AssignedUser",
        render: (user: Lead["AssignedUser"]) =>
          user ? <span className="text-sm">{user.full_name}</span> : <span className="text-slate-400">Unassigned</span>,
      },
    ];

    // Append active custom field columns
    const customCols: ColumnsType<Lead> = customFields
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => ({
        key: `custom_${field.field_key}`,
        title: field.label,
        render: (_: unknown, record: Lead) => renderCustomValue(field, record.custom_data?.[field.field_key]),
      }));

    const allCols: ColumnsType<Lead> = [
      ...builtIn,
      ...customCols,
      // Actions column is always shown
      {
        key: "actions",
        title: "Actions",
        width: 80,
        render: (_: unknown, record: Lead) => (
          <Space size={4}>
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<SquarePen size={14} className="!text-blue-500" />} className="!rounded-lg hover:!bg-blue-50" onClick={() => openEditModal(record)} />
            </Tooltip>
            <Tooltip title="Delete">
              <Button type="text" size="small" icon={<Trash2 size={14} className="!text-red-500" />} className="!rounded-lg hover:!bg-red-50" onClick={() => handleDelete(record)} />
            </Tooltip>
          </Space>
        ),
      },
    ];

    // Filter out hidden columns (by key)
    return allCols.filter((col) => col.key === "actions" || !hiddenFields.includes(String(col.key)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFields, hiddenFields, handleStageChange, handleDelete]);

  return (
    <div>
      <PageSection
        title="Leads"
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
            Add Lead
          </Button>
        }
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
        <div className="flex items-center gap-2">
          <Input.Search
            placeholder="Search leads..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
            allowClear
          />
          {viewMode === "list" && (
            <Badge count={hiddenFields.length > 0 ? hiddenFields.length : 0} size="small" offset={[-4, 4]}>
              <Button icon={<SlidersHorizontal size={14} />} onClick={() => setColDrawerOpen(true)}>
                Columns
              </Button>
            </Badge>
          )}
        </div>
      </div>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {STAGE_OPTIONS.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDropToStage(stage)}
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
                      {lead.source && <SourceTag source={lead.source} />}
                      {lead.city && <Tag>{lead.city}</Tag>}
                      <Tag color={lead.score >= 80 ? "green" : lead.score >= 50 ? "blue" : lead.score >= 20 ? "gold" : "red"}>
                        {lead.score >= 80 ? "HOT" : lead.score >= 50 ? "High" : lead.score >= 20 ? "Medium" : "Low"} {lead.score}
                      </Tag>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">{lead.AssignedUser?.full_name ?? "Unassigned"}</div>
                      <Space size={2}>
                        <Tooltip title="Lead Summary">
                          <Button
                            type="text"
                            size="small"
                            icon={<History size={14} className="!text-teal-500" />}
                            onClick={() => void openSummaryHistory(lead)}
                          />
                        </Tooltip>
                        {/* <Tooltip title="Regenerate AI Summary">
                          <Button
                            type="text"
                            size="small"
                            icon={<RefreshCw size={14} className="!text-violet-500" />}
                            loading={regeneratingId === lead.id}
                            onClick={() => void handleRegenerateSummary(lead)}
                          />
                        </Tooltip> */}
                        <Button
                          type="text"
                          size="small"
                          icon={<SquarePen size={14} className="!text-blue-500" />}
                          onClick={() => openEditModal(lead)}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<Trash2 size={14} className="!text-red-500" />}
                          onClick={() => handleDelete(lead)}
                        />
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable rowKey="id" loading={loading} dataSource={filtered} columns={columns} />
      )}

      {/* Summary History Modal */}
      <Modal
        title={
          <div>
            <div className="font-semibold">{historyLead?.name} — Summary History</div>
            <div className="text-xs font-normal text-slate-400">AI-generated snapshots ordered by date</div>
          </div>
        }
        open={!!historyLead}
        onCancel={() => setHistoryLead(null)}
        footer={null}
        width={620}
        destroyOnClose
      >
        {historyLoading ? (
          <div className="flex justify-center py-8 text-slate-400">Loading...</div>
        ) : summaryHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No summaries yet. They are generated automatically when score or stage changes.</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {summaryHistory.map((entry) => {
              const scoreColor = entry.score >= 80 ? "green" : entry.score >= 50 ? "blue" : entry.score >= 20 ? "gold" : "red";
              const scoreLabel = entry.score >= 80 ? "HOT" : entry.score >= 50 ? "High" : entry.score >= 20 ? "Medium" : "Low";
              const intentColor: Record<string, string> = { high: "green", medium: "orange", low: "blue", unknown: "default" };
              const stageColor: Record<string, string> = { new: "blue", qualified: "cyan", discussion: "orange", won: "green", lost: "red" };
              return (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">
                      {new Date(entry.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Tag color={intentColor[entry.intent] ?? "default"} className="!text-xs !m-0 capitalize">
                        {entry.intent} intent
                      </Tag>
                      <Tag color={scoreColor} className="!text-xs !m-0">
                        {scoreLabel} · {entry.score}
                      </Tag>
                      <Tag color={stageColor[entry.stage] ?? "default"} className="!text-xs !m-0 capitalize">
                        {entry.stage}
                      </Tag>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed m-0">{entry.summary}</p>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        title={editingLead ? "Edit Lead" : "Add Lead"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editingLead ? "Update" : "Create"}
        confirmLoading={saving}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="name"
              label="Lead Name"
              rules={[{ required: true, message: "Name is required." }]}
            >
              <Input placeholder="Dr. John Doe" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone"
              rules={[
                { required: true, message: "Phone is required." },
                { pattern: /^[0-9+\-\s()]{7,20}$/, message: "Enter a valid phone number." },
              ]}
            >
              <Input placeholder="+91 99999 99999" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email is required." },
                { type: "email", message: "Enter a valid email." },
              ]}
            >
              <Input placeholder="clinic@example.com" />
            </Form.Item>

            <Form.Item
              name="source"
              label="Source"
              rules={[{ required: true, message: "Source is required." }]}
            >
              <Select
                placeholder="Select source"
                options={SOURCE_OPTIONS.map((s) => ({
                  value: s,
                  label: <SourceLabel source={s} />,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="city"
              label="City"
              rules={[{ required: true, message: "City is required." }]}
            >
              <Input placeholder="Mumbai" />
            </Form.Item>

            <Form.Item
              name="stage"
              label="Stage"
              initialValue="new"
              rules={[{ required: true, message: "Stage is required." }]}
            >
              <Select
                options={STAGE_OPTIONS.map((s) => ({
                  value: s,
                  label: <Tag color={STAGE_COLOR[s]}>{s}</Tag>,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="score"
              label="Score"
              initialValue={0}
              rules={[{ required: true, message: "Score is required." }]}
            >
              <InputNumber min={0} max={100} className="w-full" placeholder="0-100" />
            </Form.Item>

            {selectedStage === "lost" && (
              <Form.Item
                name="lost_remark"
                label="Remark"
                className="col-span-2"
                rules={[
                  { required: true, message: "Remark is required when stage is lost." },
                  { max: 500, message: "Remark must be 500 characters or fewer." },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Please add the reason for marking this lead as lost."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            )}

            {isAdmin && (
              <Form.Item
                name="assigned_to"
                label="Assigned To"
                className="col-span-2"
                rules={[{ required: true, message: "Assigned To is required." }]}
              >
                <Select
                  placeholder="Select team member"
                  options={teammateOptions}
                  showSearch
                  optionFilterProp="label"
                  loading={isAdmin && teammates.length === 0}
                />
              </Form.Item>
            )}
          </div>

          <Form.Item
            name="notes"
            label="Notes"
            rules={[{ required: true, message: "Notes is required." }]}
          >
            <Input.TextArea rows={3} placeholder="Any relevant details about this lead..." />
          </Form.Item>

          {/* Custom Fields section */}
          {customFields.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 mt-1">
                Custom Fields
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                {customFields.map((field) => (
                  <Form.Item
                    key={field.field_key}
                    name={["custom_data", field.field_key]}
                    label={field.label}
                    rules={field.is_required ? [{ required: true, message: `${field.label} is required.` }] : []}
                  >
                    {renderCustomInput(field)}
                  </Form.Item>
                ))}
              </div>
            </>
          )}
        </Form>
      </Modal>

      {/* Column Picker Drawer */}
      <Drawer
        title="Manage Columns"
        open={colDrawerOpen}
        onClose={() => setColDrawerOpen(false)}
        width={300}
        footer={
          <div className="flex gap-2">
            <Button block onClick={() => { setHiddenFields([]); void savePrefs([]); setColDrawerOpen(false); }}>
              Show All
            </Button>
            <Button
              type="primary"
              block
              loading={savingPrefs}
              onClick={() => { void savePrefs(hiddenFields); setColDrawerOpen(false); }}
            >
              Save
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-400 mb-4">
          Check columns to show them. Preferences are saved per clinic.
        </p>
        <Checkbox.Group
          className="flex flex-col gap-3"
          value={visibleKeys}
          onChange={(checked) => {
            const hidden = allColumnDefs.map((c) => c.key).filter((k) => !checked.includes(k));
            setHiddenFields(hidden);
          }}
        >
          {allColumnDefs.map((col) => (
            <Checkbox key={col.key} value={col.key}>
              <span className="text-sm">{col.label}</span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Drawer>
    </div>
  );
}
