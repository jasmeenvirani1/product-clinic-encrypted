"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Modal, Space, Tabs, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Eye, Plus, SquarePen, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { managePagesService, type ManagedPage } from "@/services/manage-pages.service";

interface PageFormValues {
  title: string;
  title_tr?: string;
  slug?: string;
  footer_label?: string;
  footer_label_tr?: string;
  show_in_footer: boolean;
  is_active: boolean;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textPreview(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function ManagePagesPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<PageFormValues>();

  const [pages, setPages] = useState<ManagedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedPage | null>(null);
  const [content, setContent] = useState("");
  const [contentTr, setContentTr] = useState("");
  const [search, setSearch] = useState("");
  const [previewing, setPreviewing] = useState<ManagedPage | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pages.filter((page) => {
      if (!q) return true;
      return (
        page.title.toLowerCase().includes(q) ||
        (page.title_tr ?? "").toLowerCase().includes(q) ||
        page.slug.toLowerCase().includes(q) ||
        textPreview(page.content).toLowerCase().includes(q) ||
        textPreview(page.content_tr ?? "").toLowerCase().includes(q)
      );
    });
  }, [pages, search]);

  const load = async () => {
    try {
      setPages(await managePagesService.getAll());
    } catch {
      void message.error("Failed to load pages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setContent("");
    setContentTr("");
    form.resetFields();
    form.setFieldsValue({ show_in_footer: false, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (page: ManagedPage) => {
    setEditing(page);
    setContent(page.content);
    setContentTr(page.content_tr ?? "");
    form.setFieldsValue({
      title: page.title,
      title_tr: page.title_tr ?? "",
      slug: page.slug,
      footer_label: page.footer_label ?? "",
      footer_label_tr: page.footer_label_tr ?? "",
      show_in_footer: page.show_in_footer,
      is_active: page.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!textPreview(content)) {
        void message.error("Page content is required.");
        return;
      }

      setSaving(true);
      const payload = {
        ...values,
        slug: slugify(values.slug || values.title),
        footer_label: values.footer_label?.trim() || values.title.trim(),
        footer_label_tr: values.footer_label_tr?.trim() || values.title_tr?.trim() || null,
        content,
        content_tr: textPreview(contentTr) ? contentTr : null,
      };

      if (editing) {
        await managePagesService.update(editing.id, payload);
        void message.success("Page updated.");
      } else {
        await managePagesService.create(payload);
        void message.success("Page created.");
      }

      setModalOpen(false);
      setLoading(true);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (page: ManagedPage) => {
    modal.confirm({
      title: `Delete ${page.title}?`,
      content: "This page will no longer be available on the public site.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await managePagesService.remove(page.id);
          void message.success("Page deleted.");
          setLoading(true);
          await load();
        } catch {
          void message.error("Failed to delete page.");
        }
      },
    });
  };

  const updateStatus = async (page: ManagedPage, values: Partial<ManagedPage>) => {
    try {
      const updated = await managePagesService.update(page.id, values);
      setPages((prev) => prev.map((item) => (item.id === page.id ? updated : item)));
    } catch {
      void message.error("Failed to update page.");
    }
  };

  const columns: ColumnsType<ManagedPage> = [
    {
      title: "Page",
      dataIndex: "title",
      render: (_: string, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.title}</div>
          {record.title_tr ? <div className="text-xs text-slate-500">{record.title_tr}</div> : null}
          <div className="text-xs text-slate-500">/pages/{record.slug}</div>
        </div>
      ),
    },
    {
      title: "Content",
      dataIndex: "content",
      render: (value: string) => <span className="line-clamp-2 text-slate-500">{textPreview(value)}</span>,
    },
    {
      title: "Footer",
      dataIndex: "show_in_footer",
      width: 90,
      render: (value: boolean, record) => (
        <AppSwitch checked={value} onChange={(checked) => void updateStatus(record, { show_in_footer: checked })} />
      ),
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (value: boolean, record) => (
        <AppSwitch checked={value} onChange={(checked) => void updateStatus(record, { is_active: checked })} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      render: (_: unknown, record) => (
        <Space size={4}>
          <Tooltip title="Preview">
            <Button
              type="text"
              size="small"
              icon={<Eye size={14} className="!text-slate-500" />}
              className="!rounded-lg hover:!bg-slate-50"
              onClick={() => setPreviewing(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEdit(record)}
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

  return (
    <div>
      <PageSection
        title="Manage Pages"
        description="Create and edit public content pages. Footer links are controlled from these page settings."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add Page
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        actions={
          <Input.Search
            placeholder="Search pages..."
            allowClear
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260 }}
          />
        }
      />

      <Modal
        title={editing ? "Edit Page" : "Add Page"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editing ? "Update" : "Add"}
        confirmLoading={saving}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="slug" label="Slug">
              <Input placeholder="privacy-policy" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="show_in_footer" label="Show in Footer" valuePropName="checked">
                <AppSwitch />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <AppSwitch />
              </Form.Item>
            </div>
          </div>
          <Tabs
            items={[
              {
                key: "en",
                label: "English",
                children: (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required." }]}>
                        <Input placeholder="Privacy Policy" />
                      </Form.Item>
                      <Form.Item name="footer_label" label="Footer Label">
                        <Input placeholder="Privacy Policy" />
                      </Form.Item>
                    </div>
                    <Form.Item label="Content" required>
                      <TiptapEditor value={content} onChange={setContent} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "tr",
                label: "Turkish",
                children: (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Form.Item name="title_tr" label="Turkish Title">
                        <Input placeholder="Gizlilik Politikası" />
                      </Form.Item>
                      <Form.Item name="footer_label_tr" label="Turkish Footer Label">
                        <Input placeholder="Gizlilik Politikası" />
                      </Form.Item>
                    </div>
                    <Form.Item label="Turkish Content">
                      <TiptapEditor value={contentTr} onChange={setContentTr} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        title={previewing?.title}
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        width={820}
      >
        <article
          className="crm-rich-content mt-4 max-h-[65vh] overflow-auto"
          dangerouslySetInnerHTML={{ __html: previewing?.content ?? "" }}
        />
      </Modal>
    </div>
  );
}
