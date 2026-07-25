import { API } from "@/utils/API";

export interface LandingFaq {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

export type LandingFaqInput = {
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
};

export const landingFaqService = {
  // Super-admin: full list (includes inactive).
  list: async (): Promise<LandingFaq[]> => {
    const { data } = await API.get("/super-admin/landing-faqs");
    return data.data;
  },

  create: async (payload: LandingFaqInput): Promise<LandingFaq> => {
    const { data } = await API.post("/super-admin/landing-faqs", payload);
    return data.data;
  },

  update: async (id: number, payload: Partial<LandingFaqInput>): Promise<LandingFaq> => {
    const { data } = await API.put(`/super-admin/landing-faqs/${id}`, payload);
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await API.delete(`/super-admin/landing-faqs/${id}`);
  },

  // Public: active FAQs for the landing page (no auth).
  getPublic: async (): Promise<Pick<LandingFaq, "id" | "question" | "answer">[]> => {
    const { data } = await API.get("/public/landing-faqs");
    return data.data;
  },
};
