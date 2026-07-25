import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";
import type { SupportTicket } from "@/utils/types";

export interface CreateTicketPayload {
  subject: string;
  description?: string;
  attachment?: File | null;
}

export const supportService = {
  async getAll(): Promise<SupportTicket[]> {
    const { data } = await api.get<ApiResponse<SupportTicket[]>>("/support");
    return data.data ?? [];
  },

  async create(payload: CreateTicketPayload): Promise<SupportTicket> {
    const fd = new FormData();
    fd.append("subject", payload.subject);
    if (payload.description) fd.append("description", payload.description);
    if (payload.attachment) fd.append("attachment", payload.attachment);
    const { data } = await api.post<ApiResponse<SupportTicket>>("/support", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async updateStatus(id: number, status: SupportTicket["status"]): Promise<SupportTicket> {
    const { data } = await api.put<ApiResponse<SupportTicket>>(`/support/${id}`, { status });
    return data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/support/${id}`);
  },
};
