"use client";

import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Tag, Tooltip } from "antd";

import { CheckCircle2, XCircle, SquarePen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import { formatCurrency } from "@/lib/utils";
import type { PlanFeatureFlags, PlanRecord } from "@/utils/types";
import { BOOLEAN_FEATURE_FIELDS, CLINIC_PAGE_LABELS } from "@/constants/planFeatures";

interface PlanFormValues {
  name: string;
  period: "monthly" | "yearly";
  monthly_price?: number;
  yearly_price?: number;
  features?: string;
  whatsapp_multi_connection?: boolean;
  dedicated_clinic_page?: "none" | "video_upload_only" | "full_access";
  chapter_instagram_integration?: boolean;
  instagram_realtime_fetch?: boolean;
  chapter_creation?: boolean;
  video_like?: boolean;
  automatic_website_generation?: boolean;
  specialities?: boolean;
}

const parseFeatures = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toNumberId = (value: string | number) => Number(value);

export default function PlansPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<PlanFormValues>();

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [search, setSearch] = useState("");

  const filteredPlans = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? plans : plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, search]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await superadminService.getPlans());
    } catch {
      void message.error("Failed to load plans.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      period: "monthly",
      monthly_price: 0,
      yearly_price: 0,
      features: "",
      dedicated_clinic_page: "none",
    });
    setModalOpen(true);
  };

  const openEditModal = (plan: PlanRecord) => {
    setEditingPlan(plan);
    const flags = plan.feature_flags ?? {};
    form.setFieldsValue({
      name: plan.name,
      period: plan.period ?? "monthly",
      monthly_price: Number(plan.monthly_price ?? (plan.period === "monthly" ? plan.price : 0) ?? 0),
      yearly_price: Number(plan.yearly_price ?? (plan.period === "yearly" ? plan.price : 0) ?? 0),
      features: (plan.features ?? []).join(", "),
      whatsapp_multi_connection: flags.whatsapp_multi_connection ?? false,
      dedicated_clinic_page: flags.dedicated_clinic_page ?? "none",
      chapter_instagram_integration: flags.chapter_instagram_integration ?? false,
      instagram_realtime_fetch: flags.instagram_realtime_fetch ?? false,
      chapter_creation: flags.chapter_creation ?? false,
      video_like: flags.video_like ?? false,
      automatic_website_generation: flags.automatic_website_generation ?? false,
      specialities: flags.specialities ?? false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload: {
        name: string;
        period: "monthly" | "yearly";
        monthly_price?: number;
        yearly_price?: number;
        features: string[];
        feature_flags: PlanFeatureFlags;
      } = {
        name: values.name,
        period: values.period,
        features: parseFeatures(values.features),
        feature_flags: {
          whatsapp_multi_connection: !!values.whatsapp_multi_connection,
          dedicated_clinic_page: values.dedicated_clinic_page ?? "none",
          chapter_instagram_integration: !!values.chapter_instagram_integration,
          instagram_realtime_fetch: !!values.instagram_realtime_fetch,
          chapter_creation: !!values.chapter_creation,
          video_like: !!values.video_like,
          automatic_website_generation: !!values.automatic_website_generation,
          specialities: !!values.specialities,
        },
      };

      if (values.monthly_price !== undefined && values.monthly_price !== null) {
        payload.monthly_price = Number(values.monthly_price);
      }

      if (values.yearly_price !== undefined && values.yearly_price !== null) {
        payload.yearly_price = Number(values.yearly_price);
      }

      if (editingPlan) {
        await superadminService.updatePlan(toNumberId(editingPlan.id), payload);
        void message.success("Plan updated.");
      } else {
        await superadminService.createPlan(payload);
        void message.success("Plan created.");
      }

      setModalOpen(false);
      setEditingPlan(null);
      form.resetFields();
      void loadPlans();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) {
        void message.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (plan: PlanRecord) => {
    modal.confirm({
      title: `Delete plan "${plan.name}"?`,
      content: "This will remove the plan from the list.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await superadminService.deletePlan(toNumberId(plan.id));
          void message.success("Plan deleted.");
          void loadPlans();
        } catch {
          void message.error("Failed to delete plan.");
        }
      },
    });
  };

  const columns = [
    { title: "Plan Name", dataIndex: "name", key: "name" },
    {
      title: "Monthly Price",
      key: "monthly_price",
      render: (_: unknown, row: PlanRecord) => formatCurrency(Number(row.monthly_price ?? 0)),
    },
    {
      title: "Yearly Price",
      key: "yearly_price",
      render: (_: unknown, row: PlanRecord) => formatCurrency(Number(row.yearly_price ?? 0)),
    },
    {
      title: "Default Period",
      key: "period",
      render: (_: unknown, row: PlanRecord) => row.period ?? "monthly",
    },
    {
      title: "Features",
      dataIndex: "features",
      key: "features",
      render: (value: string[]) => (
        <ul className="list-disc pl-5">
          {(value ?? []).map((item, idx) => (
            <li key={`${item}-${idx}`}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      title: "Feature Access",
      key: "feature_access",
      render: (_: unknown, row: PlanRecord) => {
        const flags = row.feature_flags ?? {};
        return (
          <div className="flex flex-col gap-1">
            {BOOLEAN_FEATURE_FIELDS.map(({ key, label }) => {
              const enabled = !!flags[key];
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  {enabled ? (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle size={13} className="shrink-0 text-slate-300" />
                  )}
                  <span className={enabled ? "text-slate-700" : "text-slate-400"}>{label}</span>
                </div>
              );
            })}
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Clinic Page:</span>
              <Tag color={flags.dedicated_clinic_page === "full_access" ? "green" : flags.dedicated_clinic_page === "video_upload_only" ? "blue" : "default"}>
                {CLINIC_PAGE_LABELS[flags.dedicated_clinic_page ?? "none"]}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, row: PlanRecord) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEditModal(row)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={14} className="!text-red-500" />}
              className="!rounded-lg hover:!bg-red-50"
              onClick={() => handleDelete(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="">
      <div className="flex items-center justify-between">
        <PageSection
          eyebrow="Super Admin"
          title="Plans Management"
          description="Create plans and manage monthly/yearly pricing, default period, and included features."
        />
        <Button type="primary" icon={<Plus size={15} />} onClick={openCreateModal}>
          Add Plan
        </Button>
      </div>

      <DataTable<PlanRecord>
        rowKey="id"
        columns={columns}
        dataSource={filteredPlans}
        loading={loading}
        actions={
          <Input.Search
            placeholder="Search plans..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
        }
      />

      <Modal
        title={editingPlan ? "Edit Plan" : "Add Plan"}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => {
          setModalOpen(false);
          setEditingPlan(null);
          form.resetFields();
        }}
        okText={editingPlan ? "Save Changes" : "Create Plan"}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="name" label="Plan name" rules={[{ required: true, message: "Plan name is required." }]}>
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="period" label="Default Period" rules={[{ required: true, message: "Period is required." }]}>
                <Select
                  size="large"
                  options={[
                    { label: "Monthly", value: "monthly" },
                    { label: "Yearly", value: "yearly" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="monthly_price" label="Monthly Price">
                <InputNumber className="!w-full" size="large" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="yearly_price" label="Yearly Price">
                <InputNumber className="!w-full" size="large" min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="features" label="Features" className="mb-3">
            <Input.TextArea rows={3} placeholder="CRM, AI Chat, Campaigns..." />
          </Form.Item>

          <div className="mb-1.5 text-sm font-semibold text-slate-700">Feature Access</div>

          <Row gutter={[12, 4]} className="mb-1">
            {BOOLEAN_FEATURE_FIELDS.map(({ key, label }) => (
              <Col span={12} key={key}>
                <div className="mb-1 flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-3">
                  <span className="text-xs text-slate-600">{label}</span>
                  <Form.Item name={key} valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
            ))}
          </Row>

          <Form.Item name="dedicated_clinic_page" label="Dedicated Clinic Page" className="mb-0">
            <Select
              size="large"
              options={[
                { label: "Not Available", value: "none" },
                { label: "Video Upload Only", value: "video_upload_only" },
                { label: "Full Access", value: "full_access" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
