import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { chatService } from "../../services/chat.service";
import type { Conversation, Message } from "../../utils/types";

interface ConversationsState {
  list: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  replyMode: "ai" | "human";
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: ConversationsState = {
  list: [],
  messages: {},
  activeConversationId: null,
  replyMode: "human",
  status: "idle",
};

export const fetchConversations = createAsyncThunk(
  "conversations/fetchList",
  () => chatService.getConversations()
);

// Silent refresh — same as fetchConversations but doesn't set status to "loading"
export const silentRefreshConversations = createAsyncThunk(
  "conversations/silentRefresh",
  () => chatService.getConversations()
);

export const fetchMessages = createAsyncThunk(
  "conversations/fetchMessages",
  (conversationId: string) => chatService.getMessages(conversationId)
);

export const sendMessageThunk = createAsyncThunk(
  "conversations/sendMessage",
  async (payload: { conversationId: string; text: string; senderType: "patient" | "human" }) => {
    const replies = await chatService.sendMessage({
      conversationId: payload.conversationId,
      text: payload.text,
      senderType: payload.senderType,
    });
    return { conversationId: payload.conversationId, messages: replies };
  }
);

export const toggleAIThunk = createAsyncThunk(
  "conversations/toggleAI",
  async (conversationId: string) => {
    const result = await chatService.toggleAI(conversationId);
    return { conversationId, aiEnabled: result.ai_enabled };
  }
);

export const markReadThunk = createAsyncThunk(
  "conversations/markRead",
  async (conversationId: string) => {
    await chatService.markRead(conversationId);
    return conversationId;
  }
);

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },
    toggleReplyMode(state) {
      state.replyMode = state.replyMode === "ai" ? "human" : "ai";
    },
    setReplyMode(state, action: PayloadAction<"ai" | "human">) {
      state.replyMode = action.payload;
    },
    openConversationForLead(state, action: PayloadAction<string>) {
      const match = state.list.find((conversation) => conversation.leadId === action.payload);
      if (match) {
        state.activeConversationId = match.id;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.map((incoming) => {
          const existing = state.list.find((c) => c.id === incoming.id);
          return { ...incoming, lastMessage: incoming.lastMessage ?? existing?.lastMessage ?? null };
        });
        state.activeConversationId = state.activeConversationId ?? action.payload[0]?.id ?? null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const conversationId = action.meta.arg;
        if (conversationId) {
          state.messages[conversationId] = action.payload;
          // Keep lastMessage in the list in sync so ChatList shows real preview
          if (action.payload.length > 0) {
            const conv = state.list.find((item) => item.id === conversationId);
            if (conv) {
              const last = action.payload[action.payload.length - 1];
              conv.lastMessage = last.text;
              conv.lastMessageAt = last.timestamp;
            }
          }
        }
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        const { conversationId, messages } = action.payload;
        state.messages[conversationId] = state.messages[conversationId] ?? [];
        state.messages[conversationId].push(...messages);
        const conversation = state.list.find((item) => item.id === conversationId);
        if (conversation && messages.length > 0) {
          const last = messages[messages.length - 1];
          conversation.lastMessageAt = last.timestamp;
          conversation.lastMessage = last.text;
        }
      })
      .addCase(toggleAIThunk.fulfilled, (state, action) => {
        const conversation = state.list.find((item) => item.id === action.payload.conversationId);
        if (conversation) {
          conversation.aiEnabled = action.payload.aiEnabled;
        }
      })
      // Silent refresh — merge so a null lastMessage from the API never wipes a value already in state
      .addCase(silentRefreshConversations.fulfilled, (state, action) => {
        state.list = action.payload.map((incoming) => {
          const existing = state.list.find((c) => c.id === incoming.id);
          return { ...incoming, lastMessage: incoming.lastMessage ?? existing?.lastMessage ?? null };
        });
      })
      .addCase(markReadThunk.fulfilled, (state, action) => {
        const conversation = state.list.find((item) => item.id === action.payload);
        if (conversation) {
          conversation.unreadCount = 0;
        }
      });
  },
});

export const { setActiveConversation, toggleReplyMode, setReplyMode, openConversationForLead } = conversationsSlice.actions;
export default conversationsSlice.reducer;
