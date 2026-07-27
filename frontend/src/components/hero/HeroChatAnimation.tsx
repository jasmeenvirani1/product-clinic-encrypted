"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HeroChatMessage } from "@/services/hero.service";
import { APP_NAME } from "@/constants/brand";

const NAVY = "var(--color-primary)";

interface Props {
  messages: HeroChatMessage[];
  /** How long the typing indicator shows before each message appears (ms). */
  typingSpeedMs?: number;
  /** Whether this box is the active slide — animation only runs when active. */
  active?: boolean;
  /** Fired once all messages have played (after the end pause). The slider uses
   *  this to advance instead of a fixed timer, so no message gets cut off. */
  onCycleComplete?: () => void;
}

/**
 * WhatsApp-style chat that reveals messages one at a time: for each message it
 * shows a typing indicator, then the bubble, then moves on. When all messages
 * are shown it pauses; if onCycleComplete is given it signals the slider to
 * advance, otherwise it restarts its own loop.
 */
export function HeroChatAnimation({ messages, typingSpeedMs = 1200, active = true, onCycleComplete }: Props) {
  const [visibleCount, setVisibleCount] = React.useState(0);
  // Which sender is currently "typing" (null = nobody). Drives the side the
  // typing indicator shows on.
  const [typingSender, setTypingSender] = React.useState<"user" | "assistant" | null>(null);

  // Keep the latest callback in a ref so the effect doesn't restart when the
  // parent re-renders with a new function identity.
  const onDoneRef = React.useRef(onCycleComplete);
  React.useEffect(() => { onDoneRef.current = onCycleComplete; }, [onCycleComplete]);

  React.useEffect(() => {
    if (!active || messages.length === 0) {
      setVisibleCount(0);
      setTypingSender(null);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const step = (index: number) => {
      if (cancelled) return;
      if (index >= messages.length) {
        // All messages shown. Hand off to the slider immediately (switch on the
        // spot); or, with no callback, pause briefly then restart the loop.
        if (onDoneRef.current) {
          onDoneRef.current();
        } else {
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setVisibleCount(0);
              step(0);
            }, 2600)
          );
        }
        return;
      }

      // Show the typing indicator on the side of whoever is about to send.
      setTypingSender(messages[index].sender === "assistant" ? "assistant" : "user");
      // Global typing speed drives every message (the admin "Chat typing speed"
      // field is the single source of truth).
      const delay = typingSpeedMs;
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setTypingSender(null);
          setVisibleCount(index + 1);
          timers.push(setTimeout(() => step(index + 1), 700));
        }, Math.max(400, delay))
      );
    };

    setVisibleCount(0);
    step(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [messages, typingSpeedMs, active]);

  const shown = messages.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-3 min-h-[300px] lg:min-h-[220px]">
      {/* Assistant header */}
      <div className="flex items-center gap-3 pb-3 mb-1 border-b border-slate-100">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14.5px] font-bold"
          style={{ background: NAVY }}
        >
          AI
        </div>
        <div>
          <div className="text-[15.5px] font-semibold text-slate-800">{APP_NAME} Assistant</div>
          <div className="flex items-center gap-1.5 text-[13.5px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Online
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {shown.map((m, i) => {
            // Assistant (the clinic's own AI) sits on the right in navy; the
            // patient's messages sit on the left in grey — like a WhatsApp
            // Business view.
            const isAssistant = m.sender === "assistant";
            return (
              <motion.div
                key={`${i}-${m.text.slice(0, 8)}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28 }}
                className={`flex ${isAssistant ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-snug ${
                    isAssistant
                      ? "text-white rounded-br-md"
                      : "bg-slate-100 text-slate-700 rounded-bl-md"
                  }`}
                  style={isAssistant ? { background: NAVY } : undefined}
                >
                  <div>{m.text}</div>
                  {m.time ? (
                    <div className={`text-[12px] mt-1 ${isAssistant ? "text-white/70" : "text-slate-400"}`}>
                      {m.time}
                      {isAssistant ? " ✓✓" : ""}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {typingSender ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex ${typingSender === "assistant" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`rounded-2xl px-4 py-3 ${
                typingSender === "assistant" ? "rounded-br-md" : "bg-slate-100 rounded-bl-md"
              }`}
              style={typingSender === "assistant" ? { background: NAVY } : undefined}
            >
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: typingSender === "assistant" ? "rgba(255,255,255,0.7)" : "#94a3b8" }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                  />
                ))}
              </span>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
