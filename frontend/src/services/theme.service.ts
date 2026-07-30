import { API } from "@/utils/API";
import type { ThemeColors } from "@/providers/ThemeProvider";

export interface ThemeApiData {
  colors: Partial<ThemeColors>;
  platformName?: string;
  platformShortName?: string;
  platformFullName?: string;
}

export interface UpdateThemePayload {
  colors?: Partial<ThemeColors>;
  /** super_admin only — backend returns 403 if a non-super_admin includes this. */
  platformName?: string;
}

export const themeService = {
  getTheme: async (): Promise<ThemeApiData> => {
    const { data } = await API.get("/super-admin/theme");
    return data.data;
  },

  updateTheme: async (payload: UpdateThemePayload): Promise<ThemeApiData> => {
    const { data } = await API.put("/super-admin/theme", payload);
    return data.data;
  },

  resetTheme: async (): Promise<ThemeApiData> => {
    const { data } = await API.post("/super-admin/theme/reset");
    return data.data;
  },
};
