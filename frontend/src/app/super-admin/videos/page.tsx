"use client";

import { useEffect, useState, useCallback } from "react";
import { App, Button, Checkbox, Image, Input, Modal, Select, Space, Tag, Tooltip, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload";
import { Eye, SquarePen, Plus, Trash2, UploadCloud } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import { formatDate } from "@/lib/utils";
import { menuService } from "@/services/rbac.service";
import type { BackendMenu, VideoRecord } from "@/utils/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");
const videoUrl = (path: string) => `${API_BASE}/uploads/videos/${path}`;

/**
 * Capture a thumbnail frame from a video File at 1 second.
 * Returns a Blob (JPEG) via canvas.
 */
function generateThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      // Seek to 1s or 25% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.25);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { URL.revokeObjectURL(url); resolve(blob); },
        "image/jpeg",
        0.8
      );
    };

    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

export default function VideosPage() {
  const { message, modal } = App.useApp();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoRecord | null>(null);
  const [viewingVideo, setViewingVideo] = useState<VideoRecord | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [menuId, setMenuId] = useState<number | null>(null);
  const [showOnLanding, setShowOnLanding] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);

  // Menu options for the dropdown
  const [menus, setMenus] = useState<BackendMenu[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await superadminService.getVideos();
      setVideos(data);
    } catch {
      void message.error("Failed to load videos.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await menuService.getAll();
        setMenus(list.filter((m) => m.is_active !== false));
      } catch {
        // Non-fatal — the dropdown will simply be empty.
      }
    })();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMenuId(null);
    setShowOnLanding(false);
    setFileList([]);
    setThumbPreview(null);
    setThumbBlob(null);
    setEditingVideo(null);
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (record: VideoRecord) => {
    setEditingVideo(record);
    setTitle(record.title);
    setDescription(record.description ?? "");
    setMenuId(record.menu_id ?? null);
    setShowOnLanding(record.show_on_landing ?? false);
    setFileList([]);
    setThumbPreview(record.thumbnail ? videoUrl(record.thumbnail) : null);
    setThumbBlob(null);
    setOpen(true);
  };

  /** When a video file is selected, auto-generate thumbnail */
  const handleFileChange = async (fl: UploadFile[]) => {
    const list = fl.slice(-1);
    setFileList(list);

    const file = list[0]?.originFileObj;
    if (file) {
      const blob = await generateThumbnail(file);
      if (blob) {
        setThumbBlob(blob);
        setThumbPreview(URL.createObjectURL(blob));
      }
    } else {
      setThumbBlob(null);
      setThumbPreview(null);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { void message.warning("Title is required."); return; }
    if (!editingVideo && fileList.length === 0) { void message.warning("Please select a video file."); return; }

    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("menu_id", menuId == null ? "" : String(menuId));
      fd.append("show_on_landing", String(showOnLanding));

      if (fileList[0]?.originFileObj) {
        fd.append("video", fileList[0].originFileObj);
      }
      if (thumbBlob) {
        fd.append("thumbnail", thumbBlob, "thumbnail.jpg");
      }

      if (editingVideo) {
        await superadminService.updateVideo(editingVideo.id, fd);
        void message.success("Video updated.");
      } else {
        await superadminService.createVideo(fd);
        void message.success("Video uploaded.");
      }
      setOpen(false);
      resetForm();
      void load();
    } catch {
      void message.error("Failed to save video.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: VideoRecord) => {
    modal.confirm({
      title: `Delete "${record.title}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await superadminService.deleteVideo(record.id);
          setVideos((prev) => prev.filter((v) => v.id !== record.id));
          void message.success("Video deleted.");
        } catch {
          void message.error("Failed to delete video.");
        }
      },
    });
  };

  const handleStatusChange = async (record: VideoRecord, status: "active" | "inactive") => {
    try {
      const fd = new FormData();
      fd.append("status", status);
      await superadminService.updateVideo(record.id, fd);
      setVideos((prev) => prev.map((v) => (v.id === record.id ? { ...v, status } : v)));
      void message.success("Status updated.");
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const columns: ColumnsType<VideoRecord> = [
    {
      title: "Thumbnail",
      dataIndex: "thumbnail",
      width: 100,
      render: (thumb: string | null) =>
        thumb ? (
          <Image
            src={videoUrl(thumb)}
            alt="thumbnail"
            width={80}
            height={50}
            className="rounded object-cover"
            style={{ objectFit: "cover" }}
            preview={false}
          />
        ) : (
          <div className="flex h-[50px] w-[80px] items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
            No preview
          </div>
        ),
    },
    {
      title: "Title",
      dataIndex: "title",
      render: (value: string, record: VideoRecord) => (
        <div>
          <div className="font-medium">{value}</div>
          {record.description && (
            <div className="text-xs text-slate-400 truncate max-w-xs">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: "Video",
      dataIndex: "file_path",
      width: 90,
      render: (file: string, record: VideoRecord) =>
        file ? (
          <Tooltip title="View video">
            <Button
              type="text"
              size="small"
              icon={<Eye size={15} className="!text-indigo-500" />}
              className="!rounded-lg hover:!bg-indigo-50"
              onClick={() => setViewingVideo(record)}
            />
          </Tooltip>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      title: "Menu",
      key: "menu",
      render: (_: unknown, record: VideoRecord) =>
        record.Menu ? (
          <Tag color="blue">{record.Menu.name}</Tag>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: VideoRecord["status"], record: VideoRecord) => (
        <Select
          value={status}
          size="small"
          variant="borderless"
          style={{ minWidth: 110 }}
          onChange={(val) => void handleStatusChange(record, val)}
          options={[
            { value: "active", label: <Tag color="green">Active</Tag> },
            { value: "inactive", label: <Tag color="default">Inactive</Tag> },
          ]}
        />
      ),
    },
    {
      title: "Uploaded By",
      key: "uploaded_by",
      render: (_: unknown, record: VideoRecord) =>
        record.UploadedByUser ? (
          <div>
            <div className="text-sm font-medium">{record.UploadedByUser.full_name}</div>
            <div className="text-xs text-slate-400">{record.UploadedByUser.email}</div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      render: (v: string) => formatDate(v),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_: unknown, record: VideoRecord) => (
        <Space size={4}>
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
    <div className="">
      <PageSection
        eyebrow="Super Admin"
        title="Video Management"
        description="Upload and manage platform videos."
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Upload Video
          </Button>
        }
      />

      <DataTable
        // cardTitle="All Videos"
        rowKey="id"
        loading={loading}
        dataSource={videos}
        columns={columns}
      />

      <Modal
        title={editingVideo ? "Edit Video" : "Upload Video"}
        open={open}
        onCancel={() => { setOpen(false); resetForm(); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingVideo ? "Save" : "Upload"}
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter video title" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <Input.TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Linked Menu</label>
            <Select
              showSearch
              allowClear
              value={menuId ?? undefined}
              onChange={(val) => setMenuId(val ?? null)}
              placeholder="Select the menu this video explains"
              optionFilterProp="label"
              style={{ width: "100%" }}
              options={menus.map((m) => ({ value: m.id, label: m.name }))}
            />
            <p className="mt-1 text-xs text-slate-400">
              The video appears as the help link on this menu&apos;s pages and in the User&apos;s Guide labelled with the menu name.
            </p>
          </div>
          <div>
            <Checkbox checked={showOnLanding} onChange={(e) => setShowOnLanding(e.target.checked)}>
              Show on landing page
            </Checkbox>
            <p className="mt-1 text-xs text-slate-400">
              When checked, this video replaces the feature image in the landing page&apos;s second section.
              Only one video can be shown at a time — checking this unchecks any other landing video.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Video File {editingVideo ? "(optional — leave empty to keep current)" : "*"}
            </label>
            <Upload.Dragger
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => void handleFileChange(fl)}
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              maxCount={1}
            >
              <p className="ant-upload-drag-icon"><UploadCloud size={32} className="mx-auto text-slate-400" /></p>
              <p className="text-sm text-slate-500">Click or drag a video file here</p>
              <p className="text-xs text-slate-400">MP4, WebM, OGG — max 500MB</p>
            </Upload.Dragger>
          </div>
          {thumbPreview && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Auto-generated Thumbnail</label>
              <img
                src={thumbPreview}
                alt="Video thumbnail preview"
                className="h-24 w-auto rounded border border-slate-200"
              />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={viewingVideo?.title ?? "View Video"}
        open={Boolean(viewingVideo)}
        onCancel={() => setViewingVideo(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {viewingVideo ? (
          <div className="space-y-3 pt-2">
            <video
              src={videoUrl(viewingVideo.file_path)}
              controls
              autoPlay
              className="aspect-video w-full rounded-xl bg-black"
            />
            {viewingVideo.description ? (
              <p className="text-sm text-slate-500">{viewingVideo.description}</p>
            ) : null}
            {viewingVideo.Menu?.name ? (
              <p className="text-xs text-slate-400">For menu: {viewingVideo.Menu.name}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
