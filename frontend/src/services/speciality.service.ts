import { API } from "@/utils/API";

export interface Speciality {
  id: number;
  tenant_id: number | null;
  slug: string;
  name: string;
  icon: string | null;
  short_description: string | null;
  detail_content: Record<string, unknown> | null;
  order: number;
  is_active: boolean;
  is_deleted: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  keywords: string | null;
  created_at: string;
  updated_at: string;
  /** Only present on tenant-resolved rows (GET /tenant/specialities): true if a
   *  tenant_id:null master row with this slug exists, regardless of which row won. */
  has_master?: boolean;
}

export type SpecialityInput = {
  slug: string;
  name: string;
  icon?: string | null;
  short_description?: string | null;
  detail_content?: Record<string, unknown> | null;
  order?: number;
  is_active?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  canonical_url?: string | null;
  keywords?: string | null;
};

export const specialityService = {
  // Super-admin: full master list (includes inactive).
  list: async (): Promise<Speciality[]> => {
    const { data } = await API.get("/super-admin/specialities");
    return data.data;
  },

  getById: async (id: number): Promise<Speciality> => {
    const { data } = await API.get(`/super-admin/specialities/${id}`);
    return data.data;
  },

  create: async (payload: SpecialityInput): Promise<Speciality> => {
    const { data } = await API.post("/super-admin/specialities", payload);
    return data.data;
  },

  update: async (id: number, payload: Partial<SpecialityInput>): Promise<Speciality> => {
    const { data } = await API.put(`/super-admin/specialities/${id}`, payload);
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await API.delete(`/super-admin/specialities/${id}`);
  },

  // Public: active master specialities for the landing page (no auth).
  getPublic: async (): Promise<
    Pick<
      Speciality,
      | "id"
      | "slug"
      | "name"
      | "icon"
      | "short_description"
      | "detail_content"
      | "order"
      | "meta_title"
      | "meta_description"
      | "og_title"
      | "og_description"
      | "og_image"
      | "canonical_url"
      | "keywords"
    >[]
  > => {
    const { data } = await API.get("/public/specialities");
    return data.data;
  },
};

// Additive exports — do not touch existing super-admin methods/types above this line.
// Tenant-side resolved/merged specialities (master + own overrides/additions).
export const tenantSpecialityService = {
  list: async (): Promise<Speciality[]> => {
    const { data } = await API.get("/tenant/specialities");
    return data.data;
  },

  createOverride: async (payload: SpecialityInput): Promise<Speciality> => {
    const { data } = await API.post("/tenant/specialities", payload);
    return data.data;
  },

  updateOverride: async (slug: string, payload: Partial<SpecialityInput>): Promise<Speciality> => {
    const { data } = await API.put(`/tenant/specialities/${slug}`, payload);
    return data.data;
  },

  revertOverride: async (slug: string): Promise<{ reverted: boolean; resolved: Speciality | null }> => {
    const { data } = await API.delete(`/tenant/specialities/${slug}`);
    return data.data;
  },
};
