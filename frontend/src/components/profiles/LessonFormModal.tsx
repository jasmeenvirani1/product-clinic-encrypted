"use client";

import { useEffect, useState } from "react";
import { App, Button, Checkbox, Form, Input, Modal } from "antd";
import { lessonService, type AvailableReel, type Lesson } from "@/services/lesson.service";

interface LessonFormModalProps {
  open: boolean;
  /** Editing an existing lesson, or null when creating a new one. */
  lesson: Lesson | null;
  onClose: () => void;
  /** Called after a successful create/edit (including reel attach/detach
   *  diffing) so the caller can refresh its owner-side lesson list and
   *  trigger a router.refresh() for the public payload. */
  onSaved: () => void;
}

interface LessonFormValues {
  title: string;
  description?: string;
  reel_ids: number[];
}

/** Single modal handling both title/description create/edit AND the reel
 *  multi-select in one form (architect decision: avoid a confusing
 *  create-then-attach two-modal chain). Reel options are sourced from the
 *  authenticated `GET /api/lessons/reels/available` endpoint (internal
 *  InstagramReel PKs), never from the public `videos` array. Editing a
 *  lesson pre-checks its currently-attached reels and diffs
 *  added/removed ids into attach/detach calls on save. */
export default function LessonFormModal({ open, lesson, onClose, onSaved }: LessonFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<LessonFormValues>();
  const [saving, setSaving] = useState(false);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [availableReels, setAvailableReels] = useState<AvailableReel[]>([]);

  const isEditing = !!lesson;

  useEffect(() => {
    if (!open) return;
    // Attached reels are keyed by ig_media_id (LessonReelSummary.id); the
    // checkbox options are keyed by the internal AvailableReel.id (number).
    // Pre-checking requires matching on ig_media_id, resolved once
    // availableReels has loaded (see the effect below).
    form.setFieldsValue({
      title: lesson?.title ?? "",
      description: lesson?.description ?? "",
      reel_ids: [],
    });
  }, [open, lesson, form]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReelsLoading(true);
    lessonService
      .availableReels()
      .then((reels) => {
        if (cancelled) return;
        setAvailableReels(reels);
        if (lesson) {
          const attachedIgIds = new Set(lesson.reels.map((r) => r.id));
          const preChecked = reels.filter((r) => attachedIgIds.has(r.ig_media_id)).map((r) => r.id);
          form.setFieldsValue({ reel_ids: preChecked });
        }
      })
      .catch(() => {
        if (!cancelled) void message.error("Failed to load your synced reels.");
      })
      .finally(() => {
        if (!cancelled) setReelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);

  const handleCancel = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async (values: LessonFormValues) => {
    setSaving(true);
    try {
      const title = (values.title || "").trim();
      const description = (values.description || "").trim();
      const selectedIds = new Set(values.reel_ids ?? []);

      let savedLesson: Lesson;
      if (lesson) {
        savedLesson = await lessonService.update(lesson.id, { title, description });
      } else {
        savedLesson = await lessonService.create({ title, description });
      }

      // Diff currently-attached (by internal PK, resolved via ig_media_id
      // against availableReels) vs. newly-selected ids, then attach/detach
      // only what changed.
      const attachedIgIds = new Set((lesson?.reels ?? []).map((r) => r.id));
      const currentlyAttachedIds = new Set(
        availableReels.filter((r) => attachedIgIds.has(r.ig_media_id)).map((r) => r.id),
      );

      const toAttach = Array.from(selectedIds).filter((id) => !currentlyAttachedIds.has(id));
      const toDetach = Array.from(currentlyAttachedIds).filter((id) => !selectedIds.has(id));

      for (const reelId of toAttach) {
        await lessonService.attachReel(savedLesson.id, reelId);
      }
      for (const reelId of toDetach) {
        await lessonService.detachReel(savedLesson.id, reelId);
      }

      void message.success(isEditing ? "Lesson updated successfully." : "Lesson created successfully.");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to save lesson.";
      void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      title={isEditing ? "Edit Lesson" : "Create Lesson"}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, whitespace: true, message: "Title is required." }]}
        >
          <Input placeholder="e.g. Root Canal Recovery Tips" />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} placeholder="What is this lesson about?" />
        </Form.Item>

        <Form.Item label="Attach Reels" name="reel_ids">
          <Checkbox.Group className="w-full">
            {reelsLoading ? (
              <p className="text-sm text-slate-500">Loading your synced reels...</p>
            ) : availableReels.length === 0 ? (
              <p className="text-sm text-slate-500">No synced reels available yet.</p>
            ) : (
              <div className="grid max-h-72 w-full grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {availableReels.map((reel) => (
                  <label
                    key={reel.id}
                    className="relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 shadow-sm"
                  >
                    <div
                      className="relative h-28 w-full bg-slate-100"
                      style={
                        !reel.thumbnail_url
                          ? { background: "linear-gradient(160deg,#1e293b,#0ea5e9)" }
                          : undefined
                      }
                    >
                      {reel.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- external Meta-hosted URL
                        <img
                          src={reel.thumbnail_url}
                          alt={reel.caption || "Instagram Reel thumbnail"}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <Checkbox value={reel.id} className="absolute right-1.5 top-1.5 rounded bg-white/90 p-0.5" />
                    </div>
                    {reel.caption && (
                      <span className="truncate px-1.5 py-1 text-[11px] text-slate-600">{reel.caption}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </Checkbox.Group>
        </Form.Item>

        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {isEditing ? "Save Changes" : "Create Lesson"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
