import { API } from "@/utils/API";

export interface HeroChatMessage {
  sender: "user" | "assistant";
  text: string;
  time: string;
  delayMs: number;
}

export interface HeroWorkflowStep {
  order: number;
  label: string;
}

export interface HeroBadge {
  label: string;
  icon: string; // 'check' | 'rupee' | ...
}

export interface HeroContent {
  id: number;
  chat_messages: HeroChatMessage[];
  workflow_steps: HeroWorkflowStep[];
  floating_badges: HeroBadge[];
  slide_interval_ms: number;
  typing_speed_ms: number;
  step_interval_ms: number;
  is_active: boolean;
}

export type HeroContentUpdate = Partial<Omit<HeroContent, "id">>;

export const heroService = {
  get: async (): Promise<HeroContent> => {
    const { data } = await API.get("/super-admin/hero-content");
    return data.data;
  },

  update: async (payload: HeroContentUpdate): Promise<HeroContent> => {
    const { data } = await API.put("/super-admin/hero-content", payload);
    return data.data;
  },
};
