import { API } from "@/utils/API";
import type { CustomField, CreateCustomFieldPayload, UpdateCustomFieldPayload } from "@/types/customField.types";

export const customFieldsService = {
  async getAll(tableName?: string): Promise<CustomField[]> {
    const params: Record<string, string> = {};
    if (tableName) params.table_name = tableName;
    const { data } = await API.get<{ success: boolean; data: CustomField[] }>("/super-admin/custom-fields", { params });
    return data.data ?? [];
  },

  async create(payload: CreateCustomFieldPayload): Promise<CustomField> {
    const { data } = await API.post<{ success: boolean; data: CustomField }>("/super-admin/custom-fields", payload);
    return data.data;
  },

  async update(id: number, payload: UpdateCustomFieldPayload): Promise<CustomField> {
    const { data } = await API.put<{ success: boolean; data: CustomField }>(`/super-admin/custom-fields/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await API.delete(`/super-admin/custom-fields/${id}`);
  },

  // Public endpoint — no auth required, used on tenant pages for faster load
  async getPublic(tableName: string): Promise<CustomField[]> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const res = await fetch(`${baseUrl}/public/custom-fields?table_name=${tableName}`);
    const json = await res.json() as { success: boolean; data: CustomField[] };
    return (json.data ?? []).filter((f: CustomField) => f.is_active);
  },
};
