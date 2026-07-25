import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";
import type { Conversation, Message } from "@/utils/types";

interface BackendConversation {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  leadScore?: number | null;
  lastMessage?: string | null;
  channel: "WhatsApp" | "Instagram" | "Web Chat";
  status: "open" | "pending" | "resolved";
  intent: "high" | "medium" | "low" | "unknown";
  aiEnabled: boolean;
  unreadCount: number;
  assignedTo: string;
  assignedToId: number | null;
  lastMessageAt: string;
  createdAt: string;
  tenantId: number | null;
}

interface BackendAttachment {
  url: string;
  mime_type: string;
  file_name: string;
  size?: number;
  kind: "image" | "video" | "audio" | "file";
}

interface BackendMessage {
  id: string;
  conversationId: string;
  sender: "patient" | "ai" | "human";
  senderName: string;
  senderId: number | null;
  text: string;
  attachments?: BackendAttachment[];
  metadata: Record<string, unknown>;
  timestamp: string;
}

const mapConversation = (c: BackendConversation): Conversation => ({
  id: c.id,
  leadId: c.leadId,
  leadName: c.leadName,
  leadPhone: c.leadPhone,
  leadScore: c.leadScore ?? null,
  lastMessage: c.lastMessage ?? null,
  channel: c.channel,
  assignedTo: c.assignedTo,
  status: c.status,
  unreadCount: c.unreadCount,
  aiEnabled: c.aiEnabled,
  lastMessageAt: c.lastMessageAt
    ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "",
  intent: c.intent,
  tenantId: c.tenantId,
});

const mapSenderType = (sender: "patient" | "ai" | "human"): "user" | "ai" | "human" => {
  if (sender === "patient") return "user";
  return sender;
};

const mapMessage = (m: BackendMessage): Message => ({
  id: m.id,
  conversationId: m.conversationId,
  sender: mapSenderType(m.sender),
  text: m.text,
  timestamp: m.timestamp
    ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "",
  senderName: m.senderName,
  attachments: m.attachments || [],
  metadata: m.metadata,
});

export const chatService = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await api.get<ApiResponse<BackendConversation[]>>("/conversations");
    return (data.data ?? []).map(mapConversation);
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await api.get<ApiResponse<BackendMessage[]>>(`/conversations/${conversationId}/messages`);
    return (data.data ?? []).map(mapMessage);
  },

  async sendMessage(input: {
    conversationId: string;
    text: string;
    senderType: "patient" | "human";
  }): Promise<Message[]> {
    const { data } = await api.post<ApiResponse<BackendMessage[]>>(
      `/conversations/${input.conversationId}/messages`,
      { text: input.text, sender_type: input.senderType }
    );
    return (data.data ?? []).map(mapMessage);
  },

  async createConversation(input: {
    lead_id: number;
    channel?: string;
    assigned_to?: number;
  }): Promise<{ id: number }> {
    const { data } = await api.post<ApiResponse<{ id: number }>>("/conversations", input);
    return data.data;
  },

  async toggleAI(conversationId: string): Promise<{ ai_enabled: boolean }> {
    const { data } = await api.put<ApiResponse<{ ai_enabled: boolean }>>(
      `/conversations/${conversationId}/toggle-ai`
    );
    return data.data;
  },

  async updateStatus(conversationId: string, status: string): Promise<void> {
    await api.put(`/conversations/${conversationId}/status`, { status });
  },

  async markRead(conversationId: string): Promise<void> {
    await api.put(`/conversations/${conversationId}/mark-read`);
  },
};
