"use client";

import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Tooltip } from "antd";

import { SquarePen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import { formatCurrency } from "@/lib/utils";
import type { PlanRecord } from "@/utils/types";

interface PlanFormValues {
  name: string;
  period: "monthly" | "yearly";
  monthly_price?: number;
  yearly_price?: number;
  campaign_count?: number;
  features?: string;
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
    });
    setModalOpen(true);
  };

  const openEditModal = (plan: PlanRecord) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      name: plan.name,
      period: plan.period ?? "monthly",
      monthly_price: Number(plan.monthly_price ?? (plan.period === "monthly" ? plan.price : 0) ?? 0),
      yearly_price: Number(plan.yearly_price ?? (plan.period === "yearly" ? plan.price : 0) ?? 0),
      campaign_count: plan.campaign_count ?? 0,
      features: (plan.features ?? []).join(", "),
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
        campaign_count?: number;
        features: string[];
      } = {
        name: values.name,
        period: values.period,
        features: parseFeatures(values.features),
      };

      if (values.monthly_price !== undefined && values.monthly_price !== null) {
        payload.monthly_price = Number(values.monthly_price);
      }

      if (values.yearly_price !== undefined && values.yearly_price !== null) {
        payload.yearly_price = Number(values.yearly_price);
      }

      if (values.campaign_count !== undefined && values.campaign_count !== null) {
        payload.campaign_count = Number(values.campaign_count);
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
      title: "Campaign Limit",
      key: "campaign_count",
      render: (_: unknown, row: PlanRecord) => row.campaign_count ?? 0,
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
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="Plan name" rules={[{ required: true, message: "Plan name is required." }]}>
            <Input />
          </Form.Item>

          <Form.Item name="period" label="Default Period" rules={[{ required: true, message: "Period is required." }]}>
            <Select
              options={[
                { label: "Monthly", value: "monthly" },
                { label: "Yearly", value: "yearly" },
              ]}
            />
          </Form.Item>

          <Form.Item name="monthly_price" label="Monthly Price">
            <InputNumber className="!w-full" min={0} />
          </Form.Item>

          <Form.Item name="yearly_price" label="Yearly Price">
            <InputNumber className="!w-full" min={0} />
          </Form.Item>

          <Form.Item name="campaign_count" label="Campaign Limit">
            <InputNumber className="!w-full" min={0} placeholder="0 = unlimited" />
          </Form.Item>

          <Form.Item name="features" label="Features">
            <Input.TextArea rows={4} placeholder="CRM, AI Chat, Campaigns..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
