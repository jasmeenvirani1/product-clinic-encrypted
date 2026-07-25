"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Badge, Button, Checkbox, Drawer, Form, Input, InputNumber, Modal, Select, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { MessageCircle, Instagram, SquarePen, Plus, Send, SlidersHorizontal, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { campaignService, type AudiencePreview, type BackendCampaign } from "@/services/campaign.service";
import { customFieldsService } from "@/services/customFields.service";
import { fieldPreferencesService } from "@/services/fieldPreferences.service";
import type { CustomField } from "@/types/customField.types";
import { formatDate } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Instagram", label: "Instagram" },
];

const OFFER_TYPE_OPTIONS = [
  { value: "discount", label: "Discount" },
  { value: "package", label: "Package Deal" },
  { value: "free_consultation", label: "Free Consultation" },
  { value: "custom", label: "Custom Offer" },
];

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Leads" },
  { value: "new_leads", label: "New Leads (recent)" },
  { value: "old_leads", label: "Old Leads (past)" },
  { value: "inactive_leads", label: "Inactive Leads (no activity)" },
  { value: "won_leads", label: "Won Leads (existing patients)" },
  { value: "lost_leads", label: "Lost Leads (bring them back)" },
];

const STATUS_COLOR: Record<string, string> = {
  draft: "default",
  active: "green",
  paused: "orange",
  completed: "blue",
};

const AUDIENCE_COLOR: Record<string, string> = {
  all: "blue",
  new_leads: "green",
  old_leads: "orange",
  inactive_leads: "red",
  won_leads: "cyan",
  lost_leads: "purple",
};

export default function CampaignsPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [campaigns, setCampaigns] = useState<BackendCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BackendCampaign | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData] = useState<AudiencePreview | null>(null);

  const [customFields, setCustomFields]   = useState<CustomField[]>([]);
  const [hiddenFields, setHiddenFields]   = useState<string[]>([]);
  const [colDrawerOpen, setColDrawerOpen] = useState(false);
  const [savingPrefs, setSavingPrefs]     = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return campaigns.filter((c) => {
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.offer_description ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [campaigns, search, statusFilter]);

  const loadCampaigns = async () => {
    try {
      const res = await campaignService.getAll();
      setCampaigns(res.data ?? []);
    } catch {
      void message.error("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCampaigns();
    customFieldsService.getPublic("campaigns").then(setCustomFields).catch(() => {});
    fieldPreferencesService.get("campaigns").then(setHiddenFields).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateModal = () => {
    setEditingCampaign(null);
    form.resetFields();
    form.setFieldsValue({ status: "draft", offer_type: "custom", audience: "all", audience_days: 30 });
    setModalOpen(true);
  };

  const openEditModal = (campaign: BackendCampaign) => {
    setEditingCampaign(campaign);
    form.setFieldsValue({
      name: campaign.name,
      offer_type: campaign.offer_type,
      offer_description: campaign.offer_description,
      message_template: campaign.message_template,
      channel: campaign.channel,
      audience: campaign.audience,
      audience_days: campaign.audience_days,
      budget: campaign.budget,
      status: campaign.status,
      whatsapp_template_name: campaign.whatsapp_template_name,
      whatsapp_template_language: campaign.whatsapp_template_language || "en_US",
      custom_data: (campaign as BackendCampaign & { custom_data?: Record<string, unknown> }).custom_data ?? {},
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingCampaign) {
        await campaignService.update(editingCampaign.id, values);
        void message.success("Campaign updated.");
      } else {
        await campaignService.create(values);
        void message.success("Campaign created.");
      }

      setModalOpen(false);
      form.resetFields();
      setLoading(true);
      await loadCampaigns();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (campaign: BackendCampaign) => {
    if (!campaign.message_template) {
      void message.warning("Add a message template before sending.");
      return;
    }

    setSendingId(campaign.id);
    let liveCount = campaign.total_recipients;
    try {
      const preview = await campaignService.previewAudience(campaign.audience, campaign.audience_days);
      liveCount = preview.data.total;
    } catch { /* use stored count as fallback */ }
    setSendingId(null);

    modal.confirm({
      title: `${campaign.status === "draft" ? "Send" : "Resend"} "${campaign.name}"?`,
      content: `This will send the campaign message to ${liveCount} leads via ${campaign.channel}. Make sure your ${campaign.channel} credentials are configured in Integrations.`,
      okText: campaign.status === "draft" ? "Send Now" : "Resend Now",
      onOk: async () => {
        try {
          const res = await campaignService.send(campaign.id);
          void message.success(res.message || "Campaign sent!");
          setLoading(true);
          await loadCampaigns();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          void message.error(msg || "Failed to send campaign.");
        }
      },
    });
  };

  const handleDelete = (campaign: BackendCampaign) => {
    modal.confirm({
      title: `Delete "${campaign.name}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await campaignService.delete(campaign.id);
          void message.success("Campaign deleted.");
          setLoading(true);
          await loadCampaigns();
        } catch {
          void message.error("Failed to delete campaign.");
        }
      },
    });
  };

  const BUILT_IN_COL_DEFS = useMemo(() => [
    { key: "name",             label: "Campaign" },
    { key: "offer_type",       label: "Offer" },
    { key: "channel",          label: "Channel" },
    { key: "audience",         label: "Audience" },
    { key: "total_recipients", label: "Recipients" },
    { key: "status",           label: "Status" },
    { key: "sent_at",          label: "Sent" },
  ], []);

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
    try { await fieldPreferencesService.save("campaigns", keys); void message.success("Saved."); }
    catch { void message.error("Failed to save."); }
    finally { setSavingPrefs(false); }
  }, [message]);

  const renderCustomValue = (field: CustomField, val: unknown) => {
    if (val === undefined || val === null || val === "") return <span className="text-slate-400">-</span>;
    if (field.field_type === "boolean") return <Tag color={val ? "green" : "default"}>{val ? "Yes" : "No"}</Tag>;
    if (field.field_type === "date" && typeof val === "string") return new Date(val).toLocaleDateString("en-IN");
    return <span>{String(val)}</span>;
  };

  const renderCustomInput = (field: CustomField) => {
    if (field.field_type === "number")  return <InputNumber className="w-full" />;
    if (field.field_type === "date")    return <Input type="date" className="w-full" />;
    if (field.field_type === "boolean") return <Select options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />;
    if (field.field_type === "select")  return <Select options={(field.options ?? []).map((o) => ({ value: o, label: o }))} allowClear />;
    return <Input />;
  };

  const columns: ColumnsType<BackendCampaign> = useMemo(() => {
  const builtInCols: ColumnsType<BackendCampaign> = [
    {
      key: "name",
      title: "Campaign",
      dataIndex: "name",
      render: (name: string, record: BackendCampaign) => (
        <div>
          <div className="font-medium">{name}</div>
          {record.offer_description && (
            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{record.offer_description}</div>
          )}
        </div>
      ),
    },
    {
      key: "offer_type",
      title: "Offer",
      dataIndex: "offer_type",
      render: (v: string) => <Tag>{v?.replace("_", " ")}</Tag>,
    },
    {
      key: "channel",
      title: "Channel",
      dataIndex: "channel",
      render: (v: string) => (
        <Space size={4}>
          {v === "WhatsApp" && <MessageCircle size={14} className="text-green-600" />}
          {v === "Instagram" && <Instagram size={14} className="text-pink-500" />}
          {v}
        </Space>
      ),
    },
    {
      key: "audience",
      title: "Audience",
      dataIndex: "audience",
      render: (v: string) => (
        <Tag color={AUDIENCE_COLOR[v] ?? "default"}>{v?.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      key: "total_recipients",
      title: "Recipients",
      dataIndex: "total_recipients",
      render: (total: number, record: BackendCampaign) => (
        <span>{record.sent_count > 0 ? `${record.sent_count} / ${total}` : total}</span>
      ),
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status",
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? "default"} className="capitalize">{status}</Tag>
      ),
    },
    {
      key: "sent_at",
      title: "Sent",
      dataIndex: "sent_at",
      render: (v: string | null) => v ? formatDate(v) : "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      render: (_: unknown, record: BackendCampaign) => (
        <Space size={4}>
          {record.status !== "completed" && (
            <Tooltip title={record.status === "draft" ? "Send Campaign" : "Resend Campaign"}>
              <Button
                type="text"
                size="small"
                loading={sendingId === record.id}
                icon={sendingId === record.id ? undefined : <Send size={14} className="!text-emerald-500" />}
                className="!rounded-lg hover:!bg-emerald-50"
                onClick={() => void handleSend(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={14} className="!text-red-500" />}
              className="!rounded-lg hover:!bg-red-50"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const customCols: ColumnsType<BackendCampaign> = customFields
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => ({
      key: `custom_${field.field_key}`,
      title: field.label,
      render: (_: unknown, record: BackendCampaign) =>
        renderCustomValue(field, (record as BackendCampaign & { custom_data?: Record<string, unknown> }).custom_data?.[field.field_key]),
    }));

  const allCols: ColumnsType<BackendCampaign> = [...builtInCols, ...customCols];
  return allCols.filter((col) => col.key === "actions" || !hiddenFields.includes(String(col.key)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFields, hiddenFields, sendingId]);

  return (
    <div className="">
      <PageSection
        eyebrow="Clnic CRM"
        title="Campaigns"
        description="Create marketing campaigns with offers to re-engage leads and increase bookings."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
            Create Campaign
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Statuses"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? null)}
              style={{ width: 160 }}
              options={[
                { value: "draft",     label: "Draft"     },
                { value: "active",    label: "Active"    },
                { value: "paused",    label: "Paused"    },
                { value: "completed", label: "Completed" },
              ]}
            />
            <Input.Search
              placeholder="Search campaigns..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <Badge count={hiddenFields.length > 0 ? hiddenFields.length : 0} size="small" offset={[-4, 4]}>
              <Button icon={<SlidersHorizontal size={14} />} onClick={() => setColDrawerOpen(true)}>
                Columns
              </Button>
            </Badge>
          </div>
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingCampaign ? "Edit Campaign" : "Create Campaign"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editingCampaign ? "Update" : "Create"}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Campaign Name"
            rules={[{ required: true, message: "Campaign name is required." }]}
          >
            <Input placeholder="e.g. Summer Discount for Hair Transplant" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="offer_type" label="Offer Type" initialValue="custom">
              <Select options={OFFER_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="channel"
              label="Send Via"
              rules={[{ required: true, message: "Channel is required." }]}
            >
              <Select placeholder="Select channel" options={CHANNEL_OPTIONS} />
            </Form.Item>
          </div>

          <Form.Item name="offer_description" label="Offer Description">
            <Input.TextArea rows={2} placeholder="e.g. 20% discount on all treatments this month" />
          </Form.Item>

          <Form.Item name="message_template" label="Message Template">
            <Input.TextArea
              rows={4}
              placeholder={`Hi {name}! 🎉 We have a special offer for you...\n\nReply YES to book.`}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="whatsapp_template_name" label="WhatsApp Template Name">
              <Input placeholder="e.g. hello_world" />
            </Form.Item>
            <Form.Item name="whatsapp_template_language" label="Template Language" initialValue="en_US">
              <Input placeholder="e.g. en_US" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="audience" label="Target Audience" initialValue="all">
              <Select options={AUDIENCE_OPTIONS} />
            </Form.Item>
            <Form.Item name="audience_days" label="Time Range (days)" initialValue={30}>
              <InputNumber className="w-full" min={1} max={365} placeholder="30" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="budget" label="Budget">
              <Input prefix="₺" placeholder="e.g. 3,500.00" />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="draft">
              <Select
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </Form.Item>
          </div>
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
            <Button block onClick={() => { setHiddenFields([]); void savePrefs([]); setColDrawerOpen(false); }}>Show All</Button>
            <Button type="primary" block loading={savingPrefs} onClick={() => { void savePrefs(hiddenFields); setColDrawerOpen(false); }}>Save</Button>
          </div>
        }
      >
        <p className="text-xs text-slate-400 mb-4">Check columns to show. Preferences are saved per clinic.</p>
        <Checkbox.Group
          className="flex flex-col gap-3"
          value={visibleKeys}
          onChange={(checked) => setHiddenFields(allColumnDefs.map((c) => c.key).filter((k) => !checked.includes(k)))}
        >
          {allColumnDefs.map((col) => (
            <Checkbox key={col.key} value={col.key}><span className="text-sm">{col.label}</span></Checkbox>
          ))}
        </Checkbox.Group>
      </Drawer>

      {/* Audience Preview Modal */}
      <Modal
        title="Audience Preview"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={<Button onClick={() => setPreviewOpen(false)}>Close</Button>}
        width={700}
        zIndex={1100}
      >
        {previewData && (
          <div>
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm">
              <strong>{previewData.total}</strong> leads match this audience criteria
              {previewData.total > 50 && <span className="text-slate-500"> (showing first 50)</span>}
            </div>
            <DataTable
              rowKey="id"
              dataSource={previewData.leads}
              columns={[
                { title: "Name", dataIndex: "name" },
                { title: "Phone", dataIndex: "phone", render: (v: string | null) => v || "—" },
                { title: "Email", dataIndex: "email", render: (v: string | null) => v || "—" },
                { title: "Stage", dataIndex: "stage", render: (v: string) => <Tag className="capitalize">{v}</Tag> },
                { title: "Source", dataIndex: "source", render: (v: string | null) => v || "—" },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
