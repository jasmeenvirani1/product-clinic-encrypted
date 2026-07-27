import { API } from "@/utils/API";

export interface SeoSetting {
  id: number;
  page_key: string;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  keywords: string | null;
  is_active: boolean;
}

export type SeoSettingInput = {
  page_key: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  canonical_url?: string | null;
  keywords?: string | null;
  is_active?: boolean;
};

export const seoSettingService = {
  // Super-admin: full list (includes inactive).
  list: async (): Promise<SeoSetting[]> => {
    const { data } = await API.get("/super-admin/seo-settings");
    return data.data;
  },

  create: async (payload: SeoSettingInput): Promise<SeoSetting> => {
    const { data } = await API.post("/super-admin/seo-settings", payload);
    return data.data;
  },

  update: async (id: number, payload: Partial<SeoSettingInput>): Promise<SeoSetting> => {
    const { data } = await API.put(`/super-admin/seo-settings/${id}`, payload);
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await API.delete(`/super-admin/seo-settings/${id}`);
  },

  // Public: active SEO row for a given page_key (no auth).
  getPublic: async (pageKey: string): Promise<SeoSetting | null> => {
    const { data } = await API.get(`/public/seo-settings/${pageKey}`);
    return data.data;
  },
};
