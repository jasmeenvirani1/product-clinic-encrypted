import { api } from "../utils/API";
import type { VideoRecord } from "../utils/types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const guideService = {
  async getVideos(): Promise<VideoRecord[]> {
    const { data } = await api.get<ApiResponse<VideoRecord[]>>("/videos/guide");
    return data.data ?? [];
  },

  async getByMenuSlug(slug: string): Promise<VideoRecord | null> {
    const { data } = await api.get<ApiResponse<VideoRecord | null>>(`/videos/by-menu/${encodeURIComponent(slug)}`);
    return data.data ?? null;
  },
};
