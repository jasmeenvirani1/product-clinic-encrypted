import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export const notificationService = {
  async list(unreadOnly = false): Promise<AppNotification[]> {
    const { data } = await api.get<ApiResponse<AppNotification[]>>("/notifications", {
      params: unreadOnly ? { unread_only: true } : undefined,
    });
    return data.data ?? [];
  },

  async markRead(id: number): Promise<void> {
    await api.patch<ApiResponse<{ id: number; is_read: boolean }>>(`/notifications/${id}/read`);
  },
};
