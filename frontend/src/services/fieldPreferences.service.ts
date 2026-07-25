import { API } from "@/utils/API";

export const fieldPreferencesService = {
  async get(tableName: string): Promise<string[]> {
    const { data } = await API.get<{ success: boolean; data: { hidden_fields: string[] } }>(
      "/field-preferences",
      { params: { table_name: tableName } }
    );
    return data.data?.hidden_fields ?? [];
  },

  async save(tableName: string, hiddenFields: string[]): Promise<void> {
    await API.put("/field-preferences", { table_name: tableName, hidden_fields: hiddenFields });
  },
};
