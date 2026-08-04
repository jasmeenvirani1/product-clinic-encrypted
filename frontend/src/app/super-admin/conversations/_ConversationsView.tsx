"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Select } from "antd";
import { PageSection } from "@/components/PageSection";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow, SUPER_ADMIN_LABEL } from "@/components/chat/ChatWindow";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { userService } from "@/services/user.service";
import { chatService } from "@/services/chat.service";
import type { Conversation, Message } from "@/utils/types";
import type { User } from "@/types/user.types";

const MESSAGES_POLL_MS = 5_000;
const CONVERSATIONS_POLL_MS = 8_000;

export function SuperAdminConversationsView({ initialId }: { initialId?: string }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [conversations,        setConversations]        = useState<Conversation[]>([]);
  const [messages,             setMessages]             = useState<Record<string, Message[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialId ?? null);
  const [tenantAdmins,         setTenantAdmins]         = useState<User[]>([]);
  const [tenantFilter,         setTenantFilter]         = useState<number | "all">("all");

  // Initial load
  useEffect(() => {
    void chatService.getConversations().then(setConversations);
    void userService.getTenantAdmins().then((res) => setTenantAdmins(res.data ?? []));
  }, []);

  // Auto-select first conversation when list loads and none is active
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Sync URL using replaceState — no navigation, no remount
  useEffect(() => {
    if (activeConversationId) {
      const target = `/super-admin/conversations/${activeConversationId}`;
      if (!pathname.endsWith(activeConversationId)) {
        window.history.replaceState(null, "", target);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const syncLastMessage = (id: string, msgs: Message[]) => {
    setMessages((prev) => ({ ...prev, [id]: msgs }));
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, lastMessage: last.text, lastMessageAt: last.timestamp } : c)
      );
    }
  };

  // Fetch messages when active conversation changes + mark read
  useEffect(() => {
    if (activeConversationId) {
      void chatService.getMessages(activeConversationId).then((msgs) => syncLastMessage(activeConversationId, msgs));
      void chatService.markRead(activeConversationId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Poll active conversation for new messages
  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId;

  useEffect(() => {
    const timer = setInterval(() => {
      const id = activeIdRef.current;
      if (id) {
        void chatService.getMessages(id).then((msgs) => syncLastMessage(id, msgs));
      }
    }, MESSAGES_POLL_MS);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll conversation list — merge lastMessage so the poll never wipes a value in state
  useEffect(() => {
    const timer = setInterval(() => {
      void chatService.getConversations().then((fresh) =>
        setConversations((prev) =>
          fresh.map((incoming) => {
            const existing = prev.find((c) => c.id === incoming.id);
            return { ...incoming, lastMessage: incoming.lastMessage ?? existing?.lastMessage ?? null };
          })
        )
      );
    }, CONVERSATIONS_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const tenantOptions = useMemo(
    () => [
      { value: "all" as const, label: "All Tenants" },
      ...tenantAdmins.map((u) => ({
        value: parseInt(u.id),
        label: u.clinic_name || u.full_name || u.email,
      })),
    ],
    [tenantAdmins]
  );

  const filteredConversations = useMemo(() => {
    if (tenantFilter === "all") return conversations;
    return conversations.filter((c) => c.tenantId === tenantFilter);
  }, [conversations, tenantFilter]);

  const activeConversation = filteredConversations.find((c) => c.id === activeConversationId);

  // Owning clinic for the open conversation, resolved from the tenant-admin list
  // already loaded for the filter.
  //
  // The backend stores `tenant_id = user.tenant_id || user.id`, so a super admin's
  // own conversations carry their *own* user id rather than null. Matching against
  // the logged-in id is therefore what identifies an internal chat — a plain null
  // check never fires, and such rows would otherwise fall through to "Clinic #<id>".
  const activeOwnerLabel = useMemo(() => {
    if (!activeConversation) return null;
    const tenantId = activeConversation.tenantId;
    if (tenantId == null) return SUPER_ADMIN_LABEL;
    if (user?.id != null && String(tenantId) === String(user.id)) return SUPER_ADMIN_LABEL;
    const owner = tenantAdmins.find((u) => parseInt(u.id) === tenantId);
    if (owner) return owner.clinic_name || owner.full_name || owner.email;
    // Not a known tenant admin and not the current super admin — treat as internal
    // rather than inventing a "Clinic #<id>" label for a clinic that isn't listed.
    return SUPER_ADMIN_LABEL;
  }, [activeConversation, tenantAdmins, user?.id]);

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    void chatService.markRead(id);
  };

  return (
    <div className="">
      <div className="flex items-center justify-between">
        <PageSection
          eyebrow="Super Admin"
          title="Conversations"
          description="View WhatsApp and Instagram conversations across all tenants."
        />
        <Select
          value={tenantFilter}
          onChange={(v) => {
            setTenantFilter(v);
            setActiveConversationId(null);
          }}
          style={{ width: 220 }}
          options={tenantOptions}
          showSearch
          optionFilterProp="label"
          placeholder="All Tenants"
        />
      </div>

      <div className="grid h-[calc(100vh-13rem)] min-h-0 gap-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm lg:grid-cols-[340px_1fr]">
        <ChatList
          conversations={filteredConversations}
          activeConversationId={activeConversationId}
          onSelect={handleSelect}
        />
        <ChatWindow
          conversation={activeConversation}
          ownerLabel={activeOwnerLabel}
          messages={messages[activeConversationId ?? ""] ?? []}
          onSend={(text) => {
            if (!activeConversationId) return;
            void chatService
              .sendMessage({ conversationId: activeConversationId, text, senderType: "human" })
              .then((replies) =>
                setMessages((prev) => ({
                  ...prev,
                  [activeConversationId]: [...(prev[activeConversationId] ?? []), ...replies],
                }))
              );
          }}
          onToggleAI={() => {
            if (!activeConversationId) return;
            void chatService.toggleAI(activeConversationId).then(() => {
              void chatService.getConversations().then(setConversations);
            });
          }}
        />
      </div>
    </div>
  );
}
