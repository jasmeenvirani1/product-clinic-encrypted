"use client";

import { Button, Card, Dropdown, Empty, message as antMessage } from "antd";
import { Bot, UserRound, AlertTriangle, MoreVertical, CalendarCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Message } from "../../utils/types";
import { ChannelHeaderBadge } from "./ChannelBadge";

const AVATAR_BG: Record<string, string> = {
  WhatsApp:   "!bg-green-500 !text-white",
  Instagram:  "!bg-pink-500 !text-white",
  "Web Chat": "!bg-slate-400 !text-white",
};

interface ChatWindowProps {
  conversation: Conversation | undefined;
  messages: Message[];
  onSend: (_text: string) => void;
  onToggleAI?: () => void;
  onBook?: (_leadId: string) => Promise<void>;
}

export const ChatWindow = ({ conversation, messages, onSend, onToggleAI, onBook }: ChatWindowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [booking, setBooking] = useState(false);
  const isNearBottomRef = useRef(true);
  const prevConversationIdRef = useRef<string | undefined>(conversation?.id);
  const prevMessagesLenRef = useRef(messages.length);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const conversationChanged = prevConversationIdRef.current !== conversation?.id;
    const messagesGrew = messages.length > prevMessagesLenRef.current;

    if (conversationChanged) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      isNearBottomRef.current = true;
    } else if (messagesGrew && isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }

    prevConversationIdRef.current = conversation?.id;
    prevMessagesLenRef.current = messages.length;
  }, [messages, conversation?.id]);

  if (!conversation) {
    return (
      <Card className="crm-card flex h-full items-center justify-center border-0">
        <Empty description="Select a conversation" />
      </Card>
    );
  }

  const menuItems = [
    {
      key: "toggle-ai",
      label: conversation.aiEnabled ? "Switch to Human Mode" : "Switch to AI Mode",
      icon: conversation.aiEnabled ? <UserRound size={14} /> : <Bot size={14} />,
      onClick: onToggleAI,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        {/* Left: avatar + name + phone */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${
                AVATAR_BG[conversation.channel] ?? "!bg-slate-400 !text-white"
              }`}
            >
              {conversation.leadName.charAt(0).toUpperCase()}
            </div>
            <ChannelHeaderBadge channel={conversation.channel} />
          </div>

          <div>
            <h3 className="text-[15px] font-semibold leading-tight text-slate-900">
              {conversation.leadName}
            </h3>
            {conversation.leadPhone && (
              <p className="mt-0.5 text-xs text-slate-400">{conversation.leadPhone}</p>
            )}
          </div>
        </div>

        {/* Right: lead score + view profile + menu */}
        <div className="flex items-center gap-3">
          {conversation.leadScore != null && (
            <div className="flex flex-col items-center border-r border-slate-200 pr-3">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Lead Score</span>
              <span className="text-xl font-bold leading-tight text-slate-900">
                {conversation.leadScore}
              </span>
            </div>
          )}

          <button
            disabled={booking || !onBook || !conversation?.leadId}
            onClick={async () => {
              if (!onBook || !conversation?.leadId) return;
              setBooking(true);
              try {
                await onBook(conversation.leadId);
                void antMessage.success("Appointment booked — lead moved to Won");
              } catch {
                void antMessage.error("Failed to book appointment");
              } finally {
                setBooking(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {booking ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <CalendarCheck size={13} strokeWidth={2.5} />
            )}
            Book
          </button>

          <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
            <Button
              type="text"
              size="small"
              className="!px-1.5 !text-slate-500"
              icon={<MoreVertical size={17} />}
            />
          </Dropdown>
        </div>
      </div>

      {/* High-intent handover banner */}
      {!conversation.aiEnabled && conversation.intent === "high" && (
        <div className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-5 py-2.5 text-sm text-orange-700">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            <strong>High intent detected</strong> — AI paused. This patient is ready to book. Please reply directly.
          </span>
          <Button
            size="small"
            className="ml-auto !text-orange-600"
            type="text"
            icon={<Bot size={13} />}
            onClick={onToggleAI}
          >
            Enable AI
          </Button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5"
      >
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center py-20">
              <p className="text-sm text-slate-400">No messages yet.</p>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Input */}
      <ChatInput channel={conversation.channel} onSend={onSend} />
    </div>
  );
};
