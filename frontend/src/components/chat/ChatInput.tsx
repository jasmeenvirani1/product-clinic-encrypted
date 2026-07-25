"use client";

import { Button, Input } from "antd";
import { MessageCircle, Instagram, Globe, SendHorizonal } from "lucide-react";
import { useState } from "react";

interface ChatInputProps {
  channel?: string;
  onSend: (_text: string) => void;
}

const CHANNEL_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  WhatsApp: {
    icon: <MessageCircle size={14} className="text-green-600" />,
    label: "Replying via WhatsApp",
    color: "text-green-600 bg-green-50 border-green-200",
  },
  Instagram: {
    icon: <Instagram size={14} className="text-pink-500" />,
    label: "Replying via Instagram",
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
};

export const ChatInput = ({ channel, onSend }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const isDisabled = !value.trim();

  const meta = channel ? CHANNEL_META[channel] : null;

  return (
    <div className="crm-form border-t border-slate-200 bg-white p-4">
      {/* Channel indicator */}
      <div className="mb-3 flex items-center gap-2">
        {meta ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
            <Globe size={13} />
            Replying via Web Chat
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">Your reply will be delivered to the patient.</span>
      </div>

      {/* Input row */}
      <div className="flex gap-3">
        <Input.TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder="Type your reply…"
          className="!rounded-lg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isDisabled) {
                onSend(value.trim());
                setValue("");
              }
            }
          }}
        />
        <Button
          type="primary"
          size="large"
          icon={<SendHorizonal size={16} />}
          disabled={isDisabled}
          className="!h-auto !rounded-lg !px-5"
          onClick={() => {
            if (isDisabled) return;
            onSend(value.trim());
            setValue("");
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};
