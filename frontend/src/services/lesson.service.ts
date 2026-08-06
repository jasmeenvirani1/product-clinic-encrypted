import { API } from "@/utils/API";

/**
 * Authenticated "Lessons" API client — clinic-owned Lesson groupings of their
 * already-synced Instagram Reels. See architecture in
 * `.ai/sessions/2026-08-06-lessons-public-profile.md` (GitHub Issue #35) for
 * the full contract.
 *
 * Note: `GET /api/lessons` (this service's `list()`) is the authenticated
 * "my lessons for the manage UI" list — separate from the *public*
 * `lessons` array on `clinic.service.ts`'s `PublicClinicDetail`, which is
 * what non-owner visitors see. The owner's manage UI on the public profile
 * page uses this service so newly-created/edited lessons reflect
 * immediately without waiting on the public payload to refresh.
 */

// Reel shape as nested inside a Lesson (both this authenticated list and the
// public payload) — keyed by `ig_media_id` (string), matching the existing
// `PublicClinicVideo` shape 1:1. NOT the internal PK — see `AvailableReel`.
export interface LessonReelSummary {
  id: string;
  thumbnail_url: string | null;
  permalink: string | null;
  views: number;
  likes: number;
  caption: string;
}

// The tenant's own synced reels, sourced from the one authenticated,
// tenant-scoped endpoint that exposes the internal `InstagramReel.id` PK —
// required for attach/detach calls. Never sourced from the public `videos`
// array (which only carries `ig_media_id`).
export interface AvailableReel {
  id: number;
  ig_media_id: string;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string;
  like_count: number;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  reels: LessonReelSummary[];
}

export interface LessonInput {
  title: string;
  description?: string;
}

export const lessonService = {
  // Owner's own lessons (authenticated, tenant-scoped) — for the manage UI.
  list: async (): Promise<Lesson[]> => {
    const { data } = await API.get("/lessons");
    return data.lessons ?? [];
  },

  // Owner's own synced reels with internal PKs — reel-picker source of truth.
  availableReels: async (): Promise<AvailableReel[]> => {
    const { data } = await API.get("/lessons/reels/available");
    return data.reels ?? [];
  },

  create: async (payload: LessonInput): Promise<Lesson> => {
    const { data } = await API.post("/lessons", payload);
    return data.lesson;
  },

  update: async (id: number, payload: Partial<LessonInput>): Promise<Lesson> => {
    const { data } = await API.put(`/lessons/${id}`, payload);
    return data.lesson;
  },

  remove: async (id: number): Promise<void> => {
    await API.delete(`/lessons/${id}`);
  },

  attachReel: async (id: number, instagramReelId: number): Promise<Lesson> => {
    const { data } = await API.post(`/lessons/${id}/reels`, { instagram_reel_id: instagramReelId });
    return data.lesson;
  },

  detachReel: async (id: number, reelId: number): Promise<Lesson> => {
    const { data } = await API.delete(`/lessons/${id}/reels/${reelId}`);
    return data.lesson;
  },
};
