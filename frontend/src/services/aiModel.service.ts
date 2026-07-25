import { API } from "@/utils/API";

export interface AiModel {
  id: number;
  name: string;
  model: string;
  provider: string;
  base_url: string | null;
  sort_order: number;
  is_active: boolean;
}

// Shape returned by the shared /ai-models list (dropdown source).
export type AiModelOption = Pick<AiModel, "id" | "name" | "model" | "provider" | "base_url">;

export type AiModelInput = {
  name: string;
  model: string;
  provider?: string;
  base_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export const aiModelService = {
  // Shared: active models for the settings dropdowns (super-admin + tenants).
  listActive: async (): Promise<AiModelOption[]> => {
    const { data } = await API.get("/ai-models");
    return data.data;
  },

  // Super-admin CRUD.
  list: async (): Promise<AiModel[]> => {
    const { data } = await API.get("/super-admin/ai-models");
    return data.data;
  },

  create: async (payload: AiModelInput): Promise<AiModel> => {
    const { data } = await API.post("/super-admin/ai-models", payload);
    return data.data;
  },

  update: async (id: number, payload: Partial<AiModelInput>): Promise<AiModel> => {
    const { data } = await API.put(`/super-admin/ai-models/${id}`, payload);
    return data.data;
  },

  remove: async (id: number): Promise<void> => {
    await API.delete(`/super-admin/ai-models/${id}`);
  },
};

// Build antd Select options from the shared model list. Value is the model id
// string (what gets stored in openai_model / default_openai_model).
export function toModelSelectOptions(models: AiModelOption[]) {
  return models.map((m) => ({
    value: m.model,
    label: m.provider ? `${m.name} · ${m.provider}` : m.name,
  }));
}
