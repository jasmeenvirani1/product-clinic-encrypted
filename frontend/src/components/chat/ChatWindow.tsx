"use client";

// eslint-disable-next-line no-unused-vars -- antMessage used by the commented-out Book button
import { Button, Card, Empty, message as antMessage } from "antd";
// eslint-disable-next-line no-unused-vars -- CalendarCheck used by the commented-out Book button
import { Bot, UserRound, AlertTriangle, CalendarCheck, Building2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Conversation, Message } from "../../utils/types";
import { ChannelHeaderBadge } from "./ChannelBadge";

/** Owner-pill label used when a conversation has no owning clinic. */
export const SUPER_ADMIN_LABEL = "Super Admin";

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
  /**
   * Owning clinic for this conversation, shown as a pill beside the mode control.
   * Super-admin only — the tenant view omits it, since every conversation there
   * already belongs to the logged-in clinic. Pass SUPER_ADMIN_LABEL for the super
   * admin's own chats to get the distinct internal pill instead of a clinic name.
   */
  ownerLabel?: string | null;
}

// `onBook`, `booking`/`setBooking`, `antMessage` and `CalendarCheck` are currently
// only referenced by the commented-out Book button in the header. They are kept so
// the button can be restored by uncommenting alone — disable the unused warnings
// rather than stripping the wiring out.
/* eslint-disable no-unused-vars */
export const ChatWindow = ({ conversation, messages, onSend, onToggleAI, onBook, ownerLabel }: ChatWindowProps) => {
  /* eslint-enable no-unused-vars */
  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-unused-vars
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

        {/* Right: owner pill + AI/human mode + lead score */}
        <div className="flex items-center gap-3">
          {/* Owner pill — which clinic this conversation belongs to. Super-admin only.
              The super admin's own chats get a distinct labelled pill rather than a
              clinic name, so internal conversations are obvious at a glance. */}
          {ownerLabel && (
            <span
              className={`inline-flex max-w-[170px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                ownerLabel === SUPER_ADMIN_LABEL
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {ownerLabel === SUPER_ADMIN_LABEL ? (
                <ShieldCheck size={12} strokeWidth={2.5} className="shrink-0" />
              ) : (
                <Building2 size={12} strokeWidth={2.5} className="shrink-0" />
              )}
              <span className="truncate">{ownerLabel}</span>
            </span>
          )}

          {/* Mode control — a two-option segmented toggle rather than a bare on/off
              switch, so the current mode is stated explicitly and either mode can be
              picked directly. Same onToggleAI handler as before; it only fires when
              the mode actually changes, so re-clicking the active side is a no-op. */}
          {onToggleAI && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => { if (!conversation.aiEnabled) onToggleAI(); }}
                aria-pressed={conversation.aiEnabled}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all ${
                  conversation.aiEnabled
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Bot size={13} strokeWidth={2.5} />
                AI
              </button>
              <button
                type="button"
                onClick={() => { if (conversation.aiEnabled) onToggleAI(); }}
                aria-pressed={!conversation.aiEnabled}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all ${
                  !conversation.aiEnabled
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UserRound size={13} strokeWidth={2.5} />
                Human
              </button>
            </div>
          )}

          {/* Divider sits on the leading edge, separating the score from the mode
              control to its left, rather than trailing after it. */}
          {conversation.leadScore != null && (
            <div className="flex flex-col items-center border-l border-slate-200 pl-3">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Lead Score</span>
              <span className="text-xl font-bold leading-tight text-slate-900">
                {conversation.leadScore}
              </span>
            </div>
          )}

          {/* Book button — hidden for now, kept intact so it can be restored by
              simply uncommenting. The onBook prop, `booking` state and the handler
              below are all still wired up; nothing else depends on this being shown.
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
          */}
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
