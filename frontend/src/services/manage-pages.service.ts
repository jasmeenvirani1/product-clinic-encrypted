import { api } from "@/utils/API";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ManagedPage {
  id: number;
  title: string;
  title_tr: string | null;
  slug: string;
  content: string;
  content_tr: string | null;
  footer_label: string | null;
  footer_label_tr: string | null;
  show_in_footer: boolean;
  is_active: boolean;
  updated_at?: string;
}

export interface ManagedPagePayload {
  title: string;
  title_tr?: string | null;
  slug: string;
  content: string;
  content_tr?: string | null;
  footer_label?: string | null;
  footer_label_tr?: string | null;
  show_in_footer: boolean;
  is_active: boolean;
}

export const managePagesService = {
  async getAll(): Promise<ManagedPage[]> {
    const { data } = await api.get<ApiResponse<ManagedPage[]>>("/manage-pages");
    return data.data ?? [];
  },

  async create(payload: ManagedPagePayload): Promise<ManagedPage> {
    const { data } = await api.post<ApiResponse<ManagedPage>>("/manage-pages", payload);
    return data.data;
  },

  async update(id: number, payload: Partial<ManagedPagePayload>): Promise<ManagedPage> {
    const { data } = await api.put<ApiResponse<ManagedPage>>(`/manage-pages/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/manage-pages/${id}`);
  },
};

export interface FooterPageLink {
  id: number;
  title: string;
  title_tr: string | null;
  slug: string;
  footer_label: string | null;
  footer_label_tr: string | null;
}

export const publicPagesService = {
  async getFooterPages(): Promise<FooterPageLink[]> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const response = await fetch(`${baseUrl}/public/pages/footer`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as ApiResponse<FooterPageLink[]>;
    return data.data ?? [];
  },

  async getBySlug(slug: string, lang?: string): Promise<ManagedPage | null> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    const response = await fetch(`${baseUrl}/public/pages/${encodeURIComponent(slug)}${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as ApiResponse<ManagedPage>;
    return data.data ?? null;
  },
};
