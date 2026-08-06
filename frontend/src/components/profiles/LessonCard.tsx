"use client";

import { App, Popconfirm } from "antd";
import { SquarePen, Trash2 } from "lucide-react";
import type { Lesson } from "@/services/lesson.service";
import { videoGradients, type PublicProfileVideo } from "@/data/profiles.mock";
import PublicProfileVideoGrid from "./PublicProfileVideoGrid";

interface LessonCardProps {
  lesson: Lesson;
  /** Owner-only edit/delete/manage-reels controls render iff true. Non-owners
   *  (including anonymous visitors) must never see these — this prop must
   *  only ever be passed `true` from a caller that has already verified
   *  ownership via the same isOwner check used elsewhere on the profile. */
  isOwner: boolean;
  onEdit?: (_lesson: Lesson) => void;
  onDelete?: (_lesson: Lesson) => void;
  deleting?: boolean;
}

// Maps a Lesson's attached reels (LessonReelSummary — real API shape) into
// the PublicProfileVideo shape PublicProfileVideoGrid/PublicProfileVideoCard
// expect, mirroring the exact mapping used for the top-level `videos` prop
// in profiles/[slug]/page.tsx so styling stays visually consistent.
function toGridVideos(lesson: Lesson): PublicProfileVideo[] {
  return lesson.reels.map((r, i): PublicProfileVideo => ({
    id: r.id,
    thumbnailGradient: videoGradients[i % videoGradients.length],
    views: r.views,
    likes: r.likes,
    caption: r.caption,
    thumbnailUrl: r.thumbnail_url,
    permalink: r.permalink,
  }));
}

/** One Lesson's title + description + attached-reels grid, reusing
 *  PublicProfileVideoGrid for visual consistency with the "Shared" tab.
 *  Owner-only edit/delete controls render alongside the title when
 *  `isOwner` is true; visitors (including anonymous) get a read-only card. */
export default function LessonCard({ lesson, isOwner, onEdit, onDelete, deleting }: LessonCardProps) {
  const { message } = App.useApp();

  const handleDelete = async () => {
    try {
      await onDelete?.(lesson);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete lesson.";
      void message.error(msg);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{lesson.title}</h3>
          {lesson.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{lesson.description}</p>
          )}
        </div>

        {isOwner && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(lesson)}
              aria-label={`Edit lesson "${lesson.title}"`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <SquarePen size={16} />
            </button>
            <Popconfirm
              title="Delete this lesson?"
              description="This removes the lesson and its reel attachments. Reels themselves stay synced."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <button
                type="button"
                aria-label={`Delete lesson "${lesson.title}"`}
                disabled={deleting}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </Popconfirm>
          </div>
        )}
      </div>

      <div className="mt-4">
        {lesson.reels.length === 0 ? (
          <p className="text-sm text-slate-500">No reels attached to this lesson yet.</p>
        ) : (
          <PublicProfileVideoGrid videos={toGridVideos(lesson)} />
        )}
      </div>
    </div>
  );
}
