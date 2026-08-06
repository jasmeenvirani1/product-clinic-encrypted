import { API } from "@/utils/API";

/**
 * Public clinic directory — backed by `GET /api/public/clinics` and
 * `GET /api/public/clinics/:username` (no auth required). See architecture
 * in `.ai/sessions/2026-08-05-public-profiles-dynamic-data-ownership-edit.md`
 * (GitHub Issue #29) for the full contract.
 *
 * Response field names are already shaped server-side to match the existing
 * `PublicProfile`/`PublicProfileVideo` TS interfaces in
 * `@/data/profiles.mock` (e.g. `username` doubles as `slug`) so
 * `PublicProfileCard`/`PublicProfileHeader` need no changes.
 */

export interface PublicClinicSummary {
  slug: string;
  name: string;
  clinic_name: string | null;
  category: string;
  avatarGradient: string;
  profile_photo_url: string | null;
  logo_url: string | null;
  username: string;
  experience: string | null;
  education: string | null;
  joinedDate: string;
}

export interface PublicClinicDetail extends PublicClinicSummary {
  videos: [];
  bio: string;
  location: string;
  handle: string;
  website: string;
  verified: boolean;
}

export const clinicService = {
  // Public directory list — no query params in v1 (matches specialityService.getPublic).
  getAllClinics: async (): Promise<PublicClinicSummary[]> => {
    const { data } = await API.get("/public/clinics");
    return data.data ?? [];
  },

  // Public single-clinic detail by username. Returns null on unknown/non-public
  // username — backend responds 200 with `data: null` (not 404), so callers
  // must treat a null `data` as "not found", not throw.
  getClinicByUsername: async (username: string): Promise<PublicClinicDetail | null> => {
    const { data } = await API.get(`/public/clinics/${encodeURIComponent(username)}`);
    return data.data ?? null;
  },
};
