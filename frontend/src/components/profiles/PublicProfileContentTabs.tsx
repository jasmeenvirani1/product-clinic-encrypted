"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "antd";
import { Plus } from "lucide-react";
import type { PublicProfileVideo, PublicProfileLesson } from "@/data/profiles.mock";
import { useAppSelector } from "@/hooks/useAppSelector";
import { lessonService, type Lesson } from "@/services/lesson.service";
import PublicProfileVideoGrid from "./PublicProfileVideoGrid";
import LessonCard from "./LessonCard";
import LessonFormModal from "./LessonFormModal";

interface PublicProfileContentTabsProps {
  videos: PublicProfileVideo[];
  /** Public-payload lessons (visitor-visible, always up to date after the
   *  server component re-fetches). Used as the initial/non-owner render;
   *  the owner's manage UI additionally loads its own authenticated list
   *  (see lessonService.list()) so newly created/edited lessons reflect
   *  immediately without waiting on a full page refresh. */
  lessons: PublicProfileLesson[];
  /** The profile being viewed's username — compared against the logged-in
   *  user to compute ownership, using the EXACT same expression as
   *  PublicProfileHeader.tsx so the two ownership checks never drift apart. */
  profileUsername: string;
}

type Tab = "shared" | "lessons";

function toOwnerLesson(lesson: PublicProfileLesson): Lesson {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    reels: lesson.reels.map((v) => ({
      id: v.id,
      thumbnail_url: v.thumbnailUrl ?? null,
      permalink: v.permalink ?? null,
      views: v.views,
      likes: v.likes,
      caption: v.caption,
    })),
  };
}

/**
 * "Shared" / "Lessons" pill tab toggle above the content grid. "Shared"
 * renders the existing Instagram-reels video grid. "Lessons" renders the
 * clinic's Lesson groupings (title + attached-reels grid) for every viewer,
 * plus owner-only create/edit/delete/manage-reels controls gated by the
 * same isOwner check used in PublicProfileHeader.tsx (Issue #35).
 */
export default function PublicProfileContentTabs({
  videos,
  lessons: initialLessons,
  profileUsername,
}: PublicProfileContentTabsProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("shared");
  const loggedInUsername = useAppSelector((state) => state.auth.user?.username);
  // Same non-null-match rule as PublicProfileHeader.tsx line 24 — a
  // logged-in user with username: null must never be treated as owner.
  const isOwner = !!loggedInUsername && loggedInUsername === profileUsername;

  // Owner's authenticated lesson list — kept separate from the public
  // `lessons` prop so create/edit/delete reflect immediately without
  // waiting on the server component's public payload to refresh.
  const [ownerLessons, setOwnerLessons] = useState<Lesson[] | null>(null);
  const [loadingOwnerLessons, setLoadingOwnerLessons] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadOwnerLessons = async () => {
    setLoadingOwnerLessons(true);
    try {
      const list = await lessonService.list();
      setOwnerLessons(list);
    } catch {
      void message.error("Failed to load your lessons.");
    } finally {
      setLoadingOwnerLessons(false);
    }
  };

  useEffect(() => {
    if (isOwner) void loadOwnerLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const displayLessons: Lesson[] = isOwner
    ? ownerLessons ?? initialLessons.map(toOwnerLesson)
    : initialLessons.map(toOwnerLesson);

  const openCreate = () => {
    setEditingLesson(null);
    setFormOpen(true);
  };

  const openEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormOpen(true);
  };

  const handleSaved = async () => {
    await loadOwnerLessons();
    // Refreshes the server component's public payload so the `lessons`
    // array (visitor-visible data) picks up the change too — mirrors
    // EditPublicProfileModal's dispatch(fetchMeThunk())-then-router.refresh()
    // pattern used by PublicProfileHeader.
    router.refresh();
  };

  const handleDelete = async (lesson: Lesson) => {
    setDeletingId(lesson.id);
    try {
      await lessonService.remove(lesson.id);
      void message.success("Lesson deleted.");
      await loadOwnerLessons();
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("shared")}
            aria-pressed={activeTab === "shared"}
            className={
              activeTab === "shared"
                ? "rounded-full px-5 py-1.5 text-sm font-semibold text-white shadow-sm"
                : "rounded-full px-5 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
            }
            style={activeTab === "shared" ? { background: "var(--color-primary)" } : undefined}
          >
            Shared
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lessons")}
            aria-pressed={activeTab === "lessons"}
            className={
              activeTab === "lessons"
                ? "rounded-full px-5 py-1.5 text-sm font-semibold text-white shadow-sm"
                : "rounded-full px-5 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
            }
            style={activeTab === "lessons" ? { background: "var(--color-primary)" } : undefined}
          >
            Lessons
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "shared" ? (
          <PublicProfileVideoGrid videos={videos} />
        ) : (
          <div className="space-y-4">
            {isOwner && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-sm"
                  style={{ background: "var(--color-primary)" }}
                >
                  <Plus size={15} /> Create Lesson
                </button>
              </div>
            )}

            {isOwner && loadingOwnerLessons && ownerLessons === null ? (
              <p className="text-center text-sm text-slate-500">Loading your lessons...</p>
            ) : displayLessons.length === 0 ? (
              <p className="text-center text-sm text-slate-500">No lessons yet.</p>
            ) : (
              displayLessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  isOwner={isOwner}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deleting={deletingId === lesson.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <LessonFormModal
          open={formOpen}
          lesson={editingLesson}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
