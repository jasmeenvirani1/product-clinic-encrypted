"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, IndianRupee } from "lucide-react";
import { HeroChatAnimation } from "./HeroChatAnimation";
import { HeroWorkflowList } from "./HeroWorkflowList";
import type { HeroContent } from "@/services/hero.service";

const NAVY = "var(--color-primary)";
const navyAlpha = (a: number) => `rgba(var(--color-primary-rgb), ${a})`;

function BadgeIcon({ icon }: { icon: string }) {
  if (icon === "rupee") return <IndianRupee size={16} />;
  return <Check size={16} strokeWidth={3} />;
}

/** Fallback content — mirrors the backend DEFAULTS so the box renders even if
 *  the public API hasn't responded yet or returns nothing. */
export const DEFAULT_HERO_CONTENT: HeroContent = {
  id: 0,
  chat_messages: [
    { sender: "user", text: "Hi! I'd like to book an appointment with Dr. Mehta.", time: "9:02 AM", delayMs: 1200 },
    { sender: "assistant", text: "Sure! Dr. Mehta has an opening tomorrow at 11:30 AM. Shall I book it?", time: "9:02 AM", delayMs: 1800 },
    { sender: "user", text: "Yes please, that works great.", time: "9:03 AM", delayMs: 1200 },
    { sender: "assistant", text: "Booked! You'll get a WhatsApp reminder before your appointment.", time: "9:03 AM", delayMs: 1800 },
  ],
  workflow_steps: [
    { order: 1, label: "Patient books appointment" },
    { order: 2, label: "Reminder sent via WhatsApp" },
    { order: 3, label: "Consultation completed" },
    { order: 4, label: "Billing & prescription shared" },
    { order: 5, label: "Follow-up & review request" },
  ],
  floating_badges: [
    { label: "Appointment confirmed", icon: "check" },
    { label: "Payment received", icon: "rupee" },
  ],
  slide_interval_ms: 6000,
  typing_speed_ms: 1200,
  step_interval_ms: 1500,
  is_active: true,
};

interface Props {
  content?: HeroContent | null;
  /** Disable auto-rotation (used in the admin preview). */
  autoRotate?: boolean;
}

/**
 * Shadow-boxed hero visual with two slides:
 *   0 → WhatsApp chat animation
 *   1 → automated workflow list
 * Auto-rotates on a timer and exposes clickable dots.
 */
export function HeroSlider({ content, autoRotate = true }: Props) {
  const data = content ?? DEFAULT_HERO_CONTENT;
  const [slide, setSlide] = React.useState(0);
  const slideCount = 2;

  const next = React.useCallback(() => setSlide((prev) => (prev + 1) % slideCount), []);

  // Both slides advance when their own animation finishes a full cycle (chat →
  // all messages shown; workflow → last step highlighted) via onCycleComplete,
  // so nothing gets cut off — no fixed slide timer is needed here.

  return (
    <div className="relative w-full max-w-[550px] mx-auto lg:mx-0 lg:ml-auto">
      <div className="absolute inset-0 -z-10 rounded-[2.5rem] blur-2xl" style={{ background: navyAlpha(0.08) }} />

      {/* Box + badges share this relative container so the badges anchor to the
          box edges. Dots live INSIDE the box (bottom-center). */}
      <div className="relative">
        {/* Shadow box */}
        <div
          className="relative flex flex-col bg-white rounded-3xl p-6 sm:p-7 min-h-[500px] lg:min-h-[460px] shadow-2xl shadow-slate-900/10 border border-slate-100 overflow-hidden"
          style={{ boxShadow: `0 24px 60px ${navyAlpha(0.14)}` }}
        >
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.4 }}
              >
                {slide === 0 ? (
                  <HeroChatAnimation
                    messages={data.chat_messages}
                    typingSpeedMs={data.typing_speed_ms}
                    active={slide === 0}
                    onCycleComplete={autoRotate ? next : undefined}
                  />
                ) : (
                  <HeroWorkflowList
                    steps={data.workflow_steps}
                    stepIntervalMs={data.step_interval_ms}
                    active={slide === 1}
                    onCycleComplete={autoRotate ? next : undefined}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Slider dots — inside the white card, pinned to the bottom-center */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === slide ? 28 : 8,
                  background: i === slide ? NAVY : navyAlpha(0.25),
                }}
              />
            ))}
          </div>
        </div>

        {/* Floating badges — anchored to the box container so they straddle the
            box edge (half over the white card, half outside). Both gently float
            up and down. Shown on both slides, stable across transitions. */}
        {data.floating_badges[0] ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{
              opacity: { delay: 0.3, duration: 0.4 },
              y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute -top-4 right-6 z-20 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg shadow-slate-900/10 text-[14px] font-semibold text-slate-700 border border-slate-100"
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: NAVY }}>
              <BadgeIcon icon={data.floating_badges[0].icon} />
            </span>
            {data.floating_badges[0].label}
          </motion.div>
        ) : null}

        {data.floating_badges[1] ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 6, 0] }}
            transition={{
              opacity: { delay: 0.5, duration: 0.4 },
              y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 },
            }}
            className="absolute -bottom-4 -left-4 z-20 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg shadow-slate-900/10 text-[14px] font-semibold text-slate-700 border border-slate-100"
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: NAVY }}>
              <BadgeIcon icon={data.floating_badges[1].icon} />
            </span>
            {data.floating_badges[1].label}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
