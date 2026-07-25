import { API } from "@/utils/API";
import type { ThemeColors } from "@/providers/ThemeProvider";

export const themeService = {
  getTheme: async (): Promise<{ colors: Partial<ThemeColors> }> => {
    const { data } = await API.get("/super-admin/theme");
    return data.data;
  },

  updateTheme: async (colors: Partial<ThemeColors>): Promise<{ colors: Partial<ThemeColors> }> => {
    const { data } = await API.put("/super-admin/theme", { colors });
    return data.data;
  },

  resetTheme: async (): Promise<{ colors: Partial<ThemeColors> }> => {
    const { data } = await API.post("/super-admin/theme/reset");
    return data.data;
  },
};
