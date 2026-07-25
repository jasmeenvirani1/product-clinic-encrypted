"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PageSection } from "@/components/PageSection";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  fetchConversations,
  fetchMessages,
  sendMessageThunk,
  setActiveConversation,
  toggleAIThunk,
  silentRefreshConversations,
  markReadThunk,
} from "@/store/slices/conversationsSlice";
import { leadsService } from "@/services/leads.service";

const MESSAGES_POLL_MS = 5_000;
const CONVERSATIONS_POLL_MS = 8_000;

export function ConversationsView({ initialId }: { initialId?: string }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { list, messages, activeConversationId } = useAppSelector((state) => state.conversations);

  // Initial load
  useEffect(() => {
    void dispatch(fetchConversations());
  }, [dispatch]);

  // Set active conversation from URL path on mount only
  const didSetInitial = useRef(false);
  useEffect(() => {
    if (initialId && !didSetInitial.current) {
      didSetInitial.current = true;
      dispatch(setActiveConversation(initialId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  // Guard: if initialId is not accessible after list loads, fall back to first conversation
  useEffect(() => {
    if (!initialId || list.length === 0) return;
    if (!list.find((c) => c.id === initialId)) {
      dispatch(setActiveConversation(list[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // Sync URL using replaceState — no navigation, no remount
  useEffect(() => {
    if (activeConversationId) {
      const target = `/app/conversations/${activeConversationId}`;
      if (!pathname.endsWith(activeConversationId)) {
        window.history.replaceState(null, "", target);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Fetch messages when the active conversation changes and mark it as read
  useEffect(() => {
    if (activeConversationId) {
      void dispatch(fetchMessages(activeConversationId));
      void dispatch(markReadThunk(activeConversationId));
    }
  }, [dispatch, activeConversationId]);

  // Poll active conversation for new inbound WhatsApp/Instagram messages
  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId;

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeIdRef.current) {
        void dispatch(fetchMessages(activeIdRef.current));
      }
    }, MESSAGES_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch]);

  // Poll conversation list for new conversations and updated unread counts
  useEffect(() => {
    const timer = setInterval(() => {
      void dispatch(silentRefreshConversations());
    }, CONVERSATIONS_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch]);

  const activeConversation = list.find((item) => item.id === activeConversationId);

  const handleSelect = (id: string) => {
    dispatch(setActiveConversation(id));
    void dispatch(markReadThunk(id));
  };

  const handleBook = async (leadId: string) => {
    await leadsService.update(leadId, { stage: "won", score: 100 });
    void dispatch(silentRefreshConversations());
  };

  return (
    <div className="">
      <PageSection
        eyebrow="Clinic CRM"
        title="Conversations"
        description="Patient conversations with AI auto-reply and human handoff."
      />
      <div className="grid h-[calc(100vh-13rem)] min-h-0 gap-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm lg:grid-cols-[340px_1fr]">
        <ChatList
          conversations={list}
          activeConversationId={activeConversationId}
          onSelect={handleSelect}
        />
        <ChatWindow
          conversation={activeConversation}
          messages={messages[activeConversationId ?? ""] ?? []}
          onSend={(text) => {
            if (!activeConversationId) return;
            void dispatch(sendMessageThunk({ conversationId: activeConversationId, text, senderType: "human" }));
          }}
          onToggleAI={() => {
            if (activeConversationId) {
              void dispatch(toggleAIThunk(activeConversationId));
            }
          }}
          onBook={handleBook}
        />
      </div>
    </div>
  );
}
