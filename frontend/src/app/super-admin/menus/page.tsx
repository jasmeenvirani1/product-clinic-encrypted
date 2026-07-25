"use client";

import {
  App,
  Badge,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tooltip,
} from "antd";
import { SquarePen, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { useCallback, useEffect, useState } from "react";
import type { BackendMenu } from "@/utils/types";
import { menuService } from "@/services/rbac.service";
import { AppSwitch } from "@/components/ui/AppSwitch";

// ─── Lucide icon options (matches what seed.js stores) ───────────────
const ICON_OPTIONS = [
  // Navigation & Layout
  "LayoutDashboard", "LayoutList", "LayoutGrid", "PanelLeft", "SidebarOpen", "Menu", "AppWindow",
  // Users & People
  "Users", "UserCog", "UserPlus", "UserCheck", "UserX", "UserCircle", "Contact", "CircleUser",
  // Buildings & Organization
  "Building2", "Building", "Hotel", "Landmark", "Hospital", "Store", "Factory", "Warehouse",
  // Finance & Payments
  "CreditCard", "BadgeDollarSign", "DollarSign", "Wallet", "Receipt", "Banknote", "PiggyBank", "CircleDollarSign", "IndianRupee",
  // Communication & Messaging
  "MessagesSquare", "MessageSquare", "MessageCircle", "Mail", "MailOpen", "Send", "Inbox", "AtSign", "Phone", "PhoneCall", "Video",
  // AI & Automation
  "Bot", "Sparkles", "Wand2", "BrainCircuit", "Cpu", "Workflow", "Zap", "Lightbulb",
  // Analytics & Charts
  "BarChart2", "BarChart3", "BarChart4", "LineChart", "PieChart", "TrendingUp", "TrendingDown", "Activity", "Gauge",
  // Files & Documents
  "FileText", "File", "FilePlus", "FileCheck", "FileSearch", "FolderOpen", "Folder", "ClipboardList", "ClipboardCheck", "Notebook",
  // Security & Auth
  "ShieldCheck", "Shield", "Lock", "Unlock", "KeyRound", "Key", "Fingerprint", "ScanFace",
  // Settings & Tools
  "Settings", "Wrench", "SlidersHorizontal", "Cog", "Filter", "Search", "Palette", "Brush",
  // Notifications & Status
  "Bell", "BellRing", "AlertCircle", "AlertTriangle", "Info", "CheckCircle", "XCircle", "Clock",
  // Medical & Health
  "Heart", "HeartPulse", "Stethoscope", "Pill", "Syringe", "Thermometer", "Cross", "Ambulance",
  // Navigation & Actions
  "Globe", "Map", "MapPin", "Navigation", "Compass", "ExternalLink", "Link", "Share2",
  // Content & Media
  "Image", "Camera", "Play", "Headphones", "Music", "Mic", "Monitor", "Smartphone", "Tablet",
  // Shopping & Commerce
  "ShoppingCart", "ShoppingBag", "Package", "Package2", "PackageCheck", "Tag", "Tags", "Gift",
  // Support & Help
  "LifeBuoy", "HelpCircle", "BookOpen", "GraduationCap", "Flag", "Bookmark", "Star", "Award",
  // Calendar & Time
  "Calendar", "CalendarDays", "CalendarCheck", "Clock", "Timer", "Hourglass",
  // Data & Storage
  "Database", "Server", "Cloud", "CloudUpload", "HardDrive", "Table", "Grid", "Layers",
  // Actions
  "Download", "Upload", "RefreshCw", "RotateCcw", "Eye", "EyeOff", "Trash2", "Copy",
  "Plus", "Minus", "Check", "X", "ArrowRight", "ArrowLeft", "Home", "Hash", "List", "QrCode", "Scan", "Printer",
];

export default function MenusPage() {
  const { message, modal } = App.useApp();

  const [menus,   setMenus]   = useState<BackendMenu[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingMenu,  setEditingMenu]  = useState<BackendMenu | null>(null);
  const [form] = Form.useForm();

  // ── Load ─────────────────────────────────────────────────────────────
  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      setMenus(await menuService.getAll());
    } catch {
      void message.error("Failed to load menus.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void loadMenus(); }, [loadMenus]);

  // ── CRUD ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingMenu(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: 0, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (menu: BackendMenu) => {
    setEditingMenu(menu);
    form.setFieldsValue({
      name:       menu.name,
      slug:       menu.slug,
      icon:       menu.icon,
      parent_id:  menu.parent_id,
      sort_order: menu.sort_order,
      is_active:  menu.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingMenu) {
        await menuService.update(editingMenu.id, values);
        void message.success("Menu updated.");
      } else {
        await menuService.create(values);
        void message.success("Menu created.");
      }
      setModalOpen(false);
      void loadMenus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    }
  };

  const handleDelete = (menu: BackendMenu) => {
    modal.confirm({
      title:   `Delete menu "${menu.name}"?`,
      content: "Removing this menu will also remove all role permissions linked to it.",
      okText:  "Delete",
      okType:  "danger",
      onOk:    async () => {
        try {
          await menuService.remove(menu.id);
          void message.success("Menu deleted.");
          void loadMenus();
        } catch {
          void message.error("Failed to delete menu.");
        }
      },
    });
  };

  // ── Auto-generate slug from name ──────────────────────────────────────
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingMenu) {
      const slug = e.target.value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      form.setFieldValue("slug", slug);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────
  const columns = [
    {
      title:     "Name",
      dataIndex: "name",
      key:       "name",
      render:    (name: string) => <span className="font-semibold">{name}</span>,
    },
    {
      title:     "Slug",
      dataIndex: "slug",
      key:       "slug",
      render:    (slug: string) => (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{slug}</code>
      ),
    },
    {
      title:     "Icon",
      dataIndex: "icon",
      key:       "icon",
      render:    (icon: string | null) =>
        icon ? (
          <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{icon}</code>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title:     "Parent ID",
      dataIndex: "parent_id",
      key:       "parent_id",
      render:    (pid: number | null) => pid ?? <span className="text-slate-400">—</span>,
    },
    {
      title:     "Order",
      dataIndex: "sort_order",
      key:       "sort_order",
      sorter:    (a: BackendMenu, b: BackendMenu) => a.sort_order - b.sort_order,
    },
    {
      title:  "Status",
      key:    "is_active",
      render: (_: unknown, row: BackendMenu) => (
        <Badge
          status={row.is_active ? "success" : "error"}
          text={row.is_active ? "Active" : "Inactive"}
        />
      ),
    },
    {
      title:  "Actions",
      key:    "actions",
      width:  120,
      render: (_: unknown, row: BackendMenu) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEdit(row)}
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

  // ── Parent options for the form select ────────────────────────────────
  const parentOptions = menus
    .filter((m) => !editingMenu || m.id !== editingMenu.id)
    .map((m) => ({ label: `${m.name} (${m.slug})`, value: m.id }));

  return (
    <div>
      <PageSection
        title="Menu Management"
        actions={
          <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>
            New Menu
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={menus}
        loading={loading}
      />

      <Modal
        title={editingMenu ? "Edit Menu" : "New Menu"}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editingMenu ? "Save Changes" : "Create Menu"}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Display Name"
            rules={[{ required: true, message: "Name is required." }]}
          >
            <Input placeholder="e.g. Clinic Reports" onChange={handleNameChange} />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true, message: "Slug is required." },
              { pattern: /^[a-z0-9-]+$/, message: "Only lowercase letters, numbers and hyphens." },
            ]}
            tooltip="Unique identifier used in permission rules. e.g. app-reports"
          >
            <Input placeholder="e.g. app-reports" />
          </Form.Item>

          <Form.Item name="icon" label="Icon Name" tooltip="Lucide React icon component name">
            <Select
              showSearch
              allowClear
              placeholder="Select icon…"
              options={ICON_OPTIONS.map((i) => ({ label: i, value: i }))}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="parent_id" label="Parent Menu">
              <Select
                allowClear
                placeholder="None (top-level)"
                options={parentOptions}
              />
            </Form.Item>

            <Form.Item name="sort_order" label="Sort Order">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>

          {editingMenu && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <AppSwitch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
