"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "antd";
import { SlidersHorizontal } from "lucide-react";
import type { Conversation } from "../../utils/types";
import { ChannelAvatarBadge, IntentBadge } from "./ChannelBadge";

type ChannelTab = "All" | "WhatsApp" | "Instagram";

const TABS: ChannelTab[] = ["All", "WhatsApp", "Instagram"];

const AVATAR_STYLE: Record<string, string> = {
  WhatsApp:   "!bg-green-500 !text-white",
  Instagram:  "!bg-pink-500 !text-white",
  "Web Chat": "!bg-slate-400 !text-white",
};

const TAB_BADGE_COLOR: Record<string, string> = {
  WhatsApp:  "bg-green-500",
  Instagram: "bg-pink-500",
};

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (_id: string) => void;
}

export const ChatList = ({ conversations, activeConversationId, onSelect }: ChatListProps) => {
  const [activeTab, setActiveTab] = useState<ChannelTab>("All");
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeConversationId) return;
    const el = itemRefs.current[activeConversationId];
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;

    if (elTop < containerTop) {
      container.scrollTo({ top: elTop, behavior: "smooth" });
    } else if (elBottom > containerBottom) {
      container.scrollTo({ top: elBottom - container.clientHeight, behavior: "smooth" });
    }
  }, [activeConversationId]);

  const filtered =
    activeTab === "All"
      ? conversations
      : conversations.filter((c) => c.channel === activeTab);

  const countByChannel = (ch: string) => conversations.filter((c) => c.channel === ch).length;

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 pt-4 pb-0">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-slate-900">All Conversations</h3>
          {/* <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <SlidersHorizontal size={16} />
          </button> */}
        </div>

        {/* Channel tabs */}
        <div className="flex items-center">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            const count = tab !== "All" ? countByChannel(tab) : 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                  isActive
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none text-white ${
                      TAB_BADGE_COLOR[tab] ?? "bg-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation list */}
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.map((conversation) => {
          const isActive = activeConversationId === conversation.id;
          const isNew = (conversation.unreadCount ?? 0) > 0;

          return (
            <div
              key={conversation.id}
              ref={(el) => { itemRefs.current[conversation.id] = el; }}
              onClick={() => onSelect(conversation.id)}
              className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 transition-colors ${
                isActive
                  ? "border-l-[3px] border-l-indigo-400 bg-indigo-50/50"
                  : "border-l-[3px] border-l-transparent hover:bg-slate-50"
              }`}
            >
              {/* Avatar with brand channel icon */}
              <div className="relative shrink-0">
                <Avatar
                  size={42}
                  className={AVATAR_STYLE[conversation.channel] ?? "!bg-slate-400 !text-white"}
                >
                  {conversation.leadName.charAt(0).toUpperCase()}
                </Avatar>
                <ChannelAvatarBadge channel={conversation.channel} />
              </div>

              <div className="min-w-0 flex-1">
                {/* Row 1: name + time */}
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {conversation.leadName}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {conversation.lastMessageAt}
                  </span>
                </div>

                {/* Row 2: last message + intent + new badge */}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-slate-400">
                    {conversation.lastMessage || "No messages yet."}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <IntentBadge intent={conversation.intent} />
                    {isNew && (
                      <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-medium leading-none text-white">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">
            No {activeTab !== "All" ? activeTab : ""} conversations yet.
          </div>
        )}
      </div>
    </div>
  );
};
