"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = "in" | "out"; // 'in' = AI/clinic (left, white) · 'out' = patient (right, green)

interface ScriptStep {
  type: Side;
  /** How long the typing indicator shows before this message appears (ms). */
  typingDur: number;
  text: string;
  time: string;
  /** Which special bubble variant to render instead of a plain text bubble. */
  variant?: "slots" | "card" | "details";
}

/** Day separator chip, always the first step of a cycle. */
const DAY_CHIP = "TODAY";

// Conversation script — mirrors the approved reference design exactly:
// greeting → booking request → available-slots list → patient picks a time →
// confirmation card → appointment-details card, then the chat clears and loops.
const SCRIPT: ScriptStep[] = [
  {
    type: "in",
    typingDur: 800,
    text: "Hi Sarah 👋 Welcome to RiverCare Clinic. How can I help you today?",
    time: "9:41 AM",
  },
  {
    type: "out",
    typingDur: 900,
    text: "I'd like to book an appointment with Dr. Kapoor tomorrow.",
    time: "9:41 AM",
  },
  {
    type: "in",
    typingDur: 1300,
    text: "Absolutely! I'd be happy to help you book an appointment with Dr. Kapoor. Here are the available slots for tomorrow:",
    time: "9:41 AM",
    variant: "slots",
  },
  {
    type: "out",
    typingDur: 700,
    text: "2:30 PM works for me.",
    time: "9:42 AM",
  },
  {
    type: "in",
    typingDur: 1400,
    text: "",
    time: "9:42 AM",
    variant: "card",
  },
  {
    type: "in",
    typingDur: 900,
    text: "",
    time: "9:42 AM",
    variant: "details",
  },
];

// Post-reveal hold time for each step, before moving to the next one (ms).
function holdDuration(step: ScriptStep): number {
  if (step.variant === "slots") return 1700;
  if (step.variant === "card" || step.variant === "details") return 1500;
  return step.text.length * 22 + 500;
}

// ─── Small inline icon set (kept local so this component has zero new deps) ──

function IconTooth() {
  return (
    <svg viewBox="0 0 24 24" fill="#128C7E" className="wadp-row-icon">
      <path d="M12 2a5 5 0 0 1 5 5c0 2-1 3.6-2.6 4.5C16.7 12.4 19 14.8 19 18v1H5v-1c0-3.2 2.3-5.6 4.6-6.5C8 10.6 7 9 7 7a5 5 0 0 1 5-5Z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#128C7E" strokeWidth={2} className="wadp-row-icon">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#128C7E" strokeWidth={2} className="wadp-row-icon">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="#EA4335" className="wadp-row-icon">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="wadp-check-icon">
      <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TickSent() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
      <path d="M1 5.5 4.5 9 11 1.5" stroke="#8696A0" strokeWidth={1.4} fill="none" />
    </svg>
  );
}

function TickRead() {
  return (
    <svg width="16" height="10" viewBox="0 0 20 11" fill="none">
      <path d="M1 5.5 4.5 9 11 1.5" stroke="#34B7F1" strokeWidth={1.4} fill="none" />
      <path d="M8 5.5 11.5 9 18 1.5" stroke="#34B7F1" strokeWidth={1.4} fill="none" />
    </svg>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingRow({ side }: { side: Side }) {
  return (
    <motion.div
      className={`wadp-row ${side === "out" ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <div className={`wadp-typing-bubble ${side === "out" ? "wadp-bubble-out" : "wadp-bubble-in"}`}>
        {[0, 1, 2].map((d) => (
          <motion.span
            key={d}
            className="wadp-dot"
            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: d * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Message bubble (plain text) ──────────────────────────────────────────────

function MessageBubble({ step, showRead }: { step: ScriptStep; showRead: boolean }) {
  const isOut = step.type === "out";
  return (
    <motion.div
      className={`wadp-row ${isOut ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
    >
      <motion.div
        className={`wadp-bubble ${isOut ? "wadp-bubble-out" : "wadp-bubble-in"}`}
        style={{ transformOrigin: isOut ? "right bottom" : "left bottom" }}
        initial={{ y: 16, scale: 0.94 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className="wadp-txt">
          {step.text}
          <span className="wadp-meta-spacer" aria-hidden="true">
            {step.time}
            {isOut ? "  ✓✓" : ""}
          </span>
        </span>
        <span className="wadp-meta">
          <span>{step.time}</span>
          {isOut && (
            <span className="wadp-ticks">
              {showRead ? <TickRead /> : <TickSent />}
            </span>
          )}
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Slots list bubble ────────────────────────────────────────────────────────

function SlotsBubble({ step }: { step: ScriptStep }) {
  return (
    <motion.div
      className="wadp-row justify-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
    >
      <motion.div
        className="wadp-bubble wadp-bubble-in wadp-bubble-slots"
        style={{ transformOrigin: "left bottom" }}
        initial={{ y: 16, scale: 0.92 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.6, 0.64, 1] }}
      >
        <div className="wadp-s-title">{step.text}</div>
        <div className="wadp-s-row"><IconCalendar />1:00 PM</div>
        <div className="wadp-s-row"><IconCalendar />2:30 PM</div>
        <div className="wadp-s-row"><IconCalendar />4:00 PM</div>
        <div className="wadp-s-more">View more slots</div>
        <span className="wadp-meta-spacer-block" aria-hidden="true">{step.time}</span>
        <span className="wadp-meta">
          <span>{step.time}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Appointment confirmed card ───────────────────────────────────────────────

function ConfirmedCard({ step }: { step: ScriptStep }) {
  return (
    <motion.div
      className="wadp-row justify-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
    >
      <motion.div
        className="wadp-bubble wadp-bubble-in wadp-bubble-card"
        style={{ transformOrigin: "left bottom" }}
        initial={{ y: 16, scale: 0.92 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.7, 0.64, 1] }}
      >
        <div className="wadp-card-head-confirm">
          <span className="wadp-check-circle"><IconCheck /></span>
          Appointment Confirmed!
        </div>
        <div className="wadp-card-body">
          <div className="wadp-card-row wadp-card-row-plain">
            Your appointment with Dr. Kapoor is scheduled for tomorrow at 2:30 PM. You&apos;ll receive a reminder before your visit.
            <span className="wadp-meta-spacer" aria-hidden="true">{step.time}</span>
          </div>
        </div>
        <span className="wadp-meta">
          <span>{step.time}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Appointment details card ─────────────────────────────────────────────────

function DetailsCard({ step }: { step: ScriptStep }) {
  return (
    <motion.div
      className="wadp-row justify-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08 }}
    >
      <motion.div
        className="wadp-bubble wadp-bubble-in wadp-bubble-details"
        style={{ transformOrigin: "left bottom" }}
        initial={{ y: 16, scale: 0.92 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.6, 0.64, 1] }}
      >
        <div className="wadp-d-title">📋 Appointment Details</div>
        <div className="wadp-d-row"><IconTooth />Dr. Kapoor</div>
        <div className="wadp-d-row"><IconCalendar />Tomorrow</div>
        <div className="wadp-d-row"><IconClock />2:30 PM</div>
        <div className="wadp-d-row"><IconPin />RiverCare Clinic</div>
        <span className="wadp-meta-spacer-block" aria-hidden="true">{step.time}</span>
        <span className="wadp-meta">
          <span>{step.time}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Day chip ──────────────────────────────────────────────────────────────────

function DayChip() {
  return (
    <motion.div
      className="wadp-day-chip"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {DAY_CHIP}
    </motion.div>
  );
}

// ─── Phone chrome (status bar, header, input bar) ─────────────────────────────

function StatusBar() {
  return (
    <div className="wadp-statusbar">
      <span>9:41</span>
      <div className="wadp-statusbar-icons">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="6" width="2.5" height="5" rx="0.5" fill="#111" />
          <rect x="4" y="4" width="2.5" height="7" rx="0.5" fill="#111" />
          <rect x="8" y="2" width="2.5" height="9" rx="0.5" fill="#111" />
          <rect x="12" y="0" width="2.5" height="11" rx="0.5" fill="#111" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path
            d="M7.5 2.2c2.6 0 5 1 6.8 2.7l-1.4 1.5A7.6 7.6 0 0 0 7.5 4.4a7.6 7.6 0 0 0-5.4 2l-1.4-1.5A9.8 9.8 0 0 1 7.5 2.2Zm0 3.4c1.5 0 2.8.6 3.8 1.5l-1.4 1.5a3.6 3.6 0 0 0-4.8 0L3.7 7.1A5.6 5.6 0 0 1 7.5 5.6Zm0 3.3c.6 0 1.1.2 1.5.6L7.5 11 6 9.5c.4-.4.9-.6 1.5-.6Z"
            fill="#111"
          />
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
          <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke="#111" />
          <rect x="2" y="2" width="16" height="7" rx="1.5" fill="#111" />
          <rect x="21.5" y="3.5" width="1.6" height="4" rx="0.8" fill="#111" />
        </svg>
      </div>
    </div>
  );
}

function ChatHeader({ statusText }: { statusText: string }) {
  return (
    <div className="wadp-header">
      <span className="wadp-back">&#8249;</span>
      <div className="wadp-avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2a5 5 0 0 1 5 5c0 2-1 3.6-2.6 4.5C16.7 12.4 19 14.8 19 18v1H5v-1c0-3.2 2.3-5.6 4.6-6.5C8 10.6 7 9 7 7a5 5 0 0 1 5-5Z"
            fill="#fff"
          />
        </svg>
      </div>
      <div className="wadp-who">
        <span className="wadp-name">
          PulseOps AI Receptionist
          <svg className="wadp-verified" viewBox="0 0 24 24" fill="#34B7F1">
            <path d="M12 2 14.5 4.5 18 4 18.5 7.5 22 9 20.5 12 22 15 18.5 16.5 18 20 14.5 19.5 12 22 9.5 19.5 6 20 5.5 16.5 2 15 3.5 12 2 9 5.5 7.5 6 4 9.5 4.5 12 2Z" />
            <path d="M9 12.3 11 14.3 15.3 9.8" stroke="#fff" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="wadp-sub">{statusText}</span>
      </div>
      <div className="wadp-actions">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#111B21">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.5 2.5.8 3.9.8.6 0 1 .4 1 1v3.5c0 .6-.4 1-1 1C10.6 21.3 2.7 13.4 2.7 3.7c0-.6.4-1 1-1H7.2c.6 0 1 .4 1 1 0 1.4.3 2.7.8 3.9.1.4.1.8-.2 1l-2.2 2.2Z" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#111B21">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </div>
    </div>
  );
}

function InputBar() {
  return (
    <div className="wadp-inputbar">
      <div className="wadp-field">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2" strokeLinecap="round" />
          <circle cx="9" cy="9.5" r="1" fill="#8696A0" />
          <circle cx="15" cy="9.5" r="1" fill="#8696A0" />
        </svg>
        <span>Type a message</span>
      </div>
      <div className="wadp-clip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#111B21" strokeWidth={2}>
          <path d="M8 12.5 15 5.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a5 5 0 0 1-7-7l7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="wadp-mic">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      </div>
    </div>
  );
}

// ─── Timeline item model (what's actually rendered in the chat scroll) ────────

type TimelineItem =
  | { kind: "day" }
  | { kind: "typing"; side: Side }
  | { kind: "message"; step: ScriptStep };

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Self-contained animated WhatsApp conversation mockup inside a realistic
 * iPhone frame. Drives the same scripted sequence as the approved reference
 * design (day chip → greeting → booking request → slots → confirmation →
 * details → clear → loop) using framer-motion + a setTimeout-driven step
 * machine, matching the pattern already used by HeroChatAnimation.
 */
export function WhatsAppDemoPhone() {
  const [items, setItems] = React.useState<TimelineItem[]>([]);
  const [statusText, setStatusText] = React.useState("Business Account");
  const [clearing, setClearing] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    async function playScript() {
      while (!cancelled) {
        setItems([{ kind: "day" }]);
        await wait(500);
        if (cancelled) return;

        for (const step of SCRIPT) {
          if (cancelled) return;
          const isAI = step.type === "in";

          if (isAI) {
            setStatusText("typing…");
            setItems((prev) => [...prev, { kind: "typing", side: step.type }]);
            await wait(step.typingDur);
            if (cancelled) return;

            // Remove the typing indicator, then reveal the real message.
            setItems((prev) => {
              const next = [...prev];
              const idx = next.findIndex((it) => it.kind === "typing");
              if (idx !== -1) next.splice(idx, 1);
              return next;
            });
            setStatusText("Business Account");
            await wait(100);
            if (cancelled) return;
          }

          setItems((prev) => [...prev, { kind: "message", step }]);
          await wait(holdDuration(step));
          if (cancelled) return;
        }

        await wait(2600);
        if (cancelled) return;

        // Seamless clear: fade the whole scroll out, empty it, fade back in —
        // mirrors the reference's clearChat() before restarting the loop.
        setClearing(true);
        await wait(400);
        if (cancelled) return;
        setItems([]);
        setClearing(false);
      }
    }

    playScript();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Auto-scroll to bottom whenever the timeline changes.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div className="wadp-root">
      <style>{WADP_STYLES}</style>
      <div className="wadp-iphone">
        <div className="wadp-screen">
          <div className="wadp-notch" />
          <StatusBar />
          <ChatHeader statusText={statusText} />

          <div className="wadp-chatbody">
            <motion.div
              ref={scrollRef}
              className="wadp-chatscroll"
              animate={{ opacity: clearing ? 0 : 1 }}
              transition={{ duration: 0.4, ease: "easeIn" }}
            >
              <AnimatePresence initial={false}>
                {items.map((item, i) => {
                  if (item.kind === "day") return <DayChip key={`day-${i}`} />;
                  if (item.kind === "typing") return <TypingRow key={`typing-${i}`} side={item.side} />;
                  const { step } = item;
                  if (step.variant === "slots") return <SlotsBubble key={`msg-${i}`} step={step} />;
                  if (step.variant === "card") return <ConfirmedCard key={`msg-${i}`} step={step} />;
                  if (step.variant === "details") return <DetailsCard key={`msg-${i}`} step={step} />;
                  return <MessageBubbleWithTicks key={`msg-${i}`} step={step} />;
                })}
              </AnimatePresence>
            </motion.div>
          </div>

          <InputBar />
        </div>
      </div>
    </div>
  );
}

// Wraps MessageBubble to upgrade its tick from "sent" to "read" ~600ms after
// mount, mirroring the reference's gsap.delayedCall(0.6, …) tick swap.
function MessageBubbleWithTicks({ step }: { step: ScriptStep }) {
  const [read, setRead] = React.useState(false);
  React.useEffect(() => {
    if (step.type !== "out") return;
    const t = setTimeout(() => setRead(true), 600);
    return () => clearTimeout(t);
  }, [step.type]);
  return <MessageBubble step={step} showRead={read} />;
}

// ─── Scoped styles ─────────────────────────────────────────────────────────────
// Plain <style> tag (same pattern used elsewhere in LandingPage.tsx for
// one-off decorative chrome) — every rule is prefixed with `.wadp-` /
// `wadp-` so nothing leaks into the rest of the page.

const WADP_STYLES = `
  .wadp-root{ display:flex; justify-content:center; width:100%; }

  .wadp-iphone{
    position:relative;
    width:100%;
    max-width:284px;
    aspect-ratio:284/580;
    background:linear-gradient(145deg,#3a3a3d,#0b0b0d 40%);
    border-radius:15.8%/8%;
    padding:3.1%;
    box-shadow:
      0 25px 60px -15px rgba(0,0,0,.55),
      0 10px 25px -8px rgba(0,0,0,.4),
      inset 0 0 0 2px rgba(255,255,255,.08);
    filter:drop-shadow(0 30px 40px rgba(0,0,0,.35));
  }

  .wadp-screen{
    position:relative;
    width:100%;
    height:100%;
    background:#E5DDD5;
    border-radius:13%/6.5%;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.4);
  }

  .wadp-notch{
    position:absolute;
    top:8px; left:50%;
    transform:translateX(-50%);
    width:84px;
    height:24px;
    background:#0b0b0d;
    border-radius:16px;
    z-index:50;
  }

  .wadp-statusbar{
    height:34px;
    flex:0 0 34px;
    background:#F7F7F5;
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    padding:5px 20px 4px;
    font-size:11.5px;
    font-weight:600;
    color:#111;
    z-index:20;
    font-family:inherit;
  }
  .wadp-statusbar-icons{ display:flex; align-items:center; gap:4px; }

  .wadp-header{
    flex:0 0 48px;
    background:#F7F7F5;
    display:flex;
    align-items:center;
    gap:8px;
    padding:4px 10px;
    color:#111B21;
    z-index:15;
    box-shadow:0 1px 0 rgba(0,0,0,.06);
  }
  .wadp-back{ font-size:18px; color:#111B21; opacity:.85; width:14px; }
  .wadp-avatar{
    width:28px; height:28px;
    border-radius:50%;
    background:linear-gradient(135deg,#0F172A,#334155);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0;
  }
  .wadp-who{ display:flex; flex-direction:column; line-height:1.2; min-width:0; }
  .wadp-name{
    font-size:10px; font-weight:700;
    display:inline-flex; align-items:center; gap:2px;
    color:#111B21;
    white-space:nowrap;
  }
  .wadp-verified{ width:9px; height:9px; flex-shrink:0; position:relative; top:0.5px; }
  .wadp-sub{ font-size:9px; color:#667781; }
  .wadp-actions{ margin-left:auto; display:flex; gap:14px; color:#111B21; flex-shrink:0; }

  .wadp-chatbody{
    flex:1;
    position:relative;
    overflow:hidden;
    background-image:
      linear-gradient(rgba(229,221,213,.0), rgba(229,221,213,.0)),
      repeating-linear-gradient(45deg, rgba(0,0,0,.015) 0, rgba(0,0,0,.015) 1px, transparent 1px, transparent 12px);
  }
  .wadp-chatscroll{
    position:absolute;
    inset:0;
    overflow-y:hidden;
    padding:6px 8px 6px;
    display:flex;
    flex-direction:column;
    justify-content:flex-start;
    gap:0;
  }

  .wadp-day-chip{
    align-self:center;
    background:#FFFFFF;
    color:#667781;
    font-size:9px;
    font-weight:600;
    padding:2px 9px;
    border-radius:7px;
    margin:0 0 4px;
    box-shadow:0 1px 1px rgba(0,0,0,.08);
  }

  .wadp-row{ display:flex; margin:2px 0; }

  .wadp-bubble{
    position:relative;
    max-width:80%;
    padding:4px 7px 4px 8px;
    border-radius:8px;
    font-size:10.5px;
    line-height:1.32;
    color:#111B21;
    box-shadow:0 1px 1px rgba(0,0,0,.13);
  }
  .wadp-bubble-in{ background:#FFFFFF; border-top-left-radius:2px; }
  .wadp-bubble-out{ background:#DCF8C6; border-top-right-radius:2px; }

  .wadp-txt{ display:inline; white-space:pre-wrap; word-wrap:break-word; }
  .wadp-meta-spacer{
    display:inline-block;
    visibility:hidden;
    font-size:8.3px;
    margin-left:6px;
    white-space:nowrap;
  }
  .wadp-meta{
    position:absolute;
    right:7px; bottom:4px;
    display:inline-flex; align-items:center; gap:2px;
    font-size:8.3px;
    color:#667781;
    white-space:nowrap;
  }
  .wadp-meta-spacer-block{
    display:block;
    visibility:hidden;
    height:11px;
    font-size:8.3px;
  }
  .wadp-ticks{ display:inline-flex; align-items:center; }

  .wadp-bubble-card{ padding:0; overflow:hidden; max-width:82%; }
  .wadp-card-head-confirm{
    background:#fff;
    color:#111B21;
    padding:6px 9px 3px;
    font-weight:700;
    font-size:9.8px;
    display:flex;
    align-items:center;
    gap:5px;
  }
  .wadp-check-circle{
    width:14px;height:14px;border-radius:50%;
    background:#25D366;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .wadp-check-icon{ width:8px;height:8px; }
  .wadp-card-body{ padding:4px 9px 4px; font-size:9.6px; color:#111B21; line-height:1.3; }
  .wadp-card-row-plain{ border:none; padding-top:0; }

  .wadp-bubble-details{ padding:5px 9px 2px 8px; max-width:80%; }
  .wadp-d-title{ font-weight:700; font-size:9.6px; margin-bottom:3px; color:#111B21; }
  .wadp-d-row{ display:flex; align-items:center; gap:5px; padding:1.5px 0; font-size:9.3px; color:#111B21; }

  .wadp-bubble-slots{ padding:5px 9px 2px 8px; max-width:82%; }
  .wadp-s-title{ font-size:10px; line-height:1.3; margin-bottom:3px; color:#111B21; }
  .wadp-s-row{
    display:flex; align-items:center; gap:6px;
    padding:2px 6px; margin:2px 0;
    background:#F5F6F6; border-radius:6px;
    font-size:9.6px; font-weight:600; color:#111B21;
  }
  .wadp-s-more{ text-align:center; font-size:8.6px; font-weight:700; color:#128C7E; margin-top:2px; }

  .wadp-row-icon{ width:11px; height:11px; flex-shrink:0; }

  .wadp-typing-bubble{
    border-radius:8px;
    padding:6px 10px;
    box-shadow:0 1px 1px rgba(0,0,0,.13);
    display:flex;
    align-items:center;
    gap:3px;
  }
  .wadp-dot{ width:5px; height:5px; border-radius:50%; background:#93999E; display:inline-block; }

  .wadp-inputbar{
    flex:0 0 38px;
    background:#F0F0F0;
    display:flex;
    align-items:center;
    gap:6px;
    padding:4px 8px;
    z-index:15;
  }
  .wadp-field{
    flex:1;
    height:26px;
    background:#fff;
    border-radius:16px;
    display:flex;
    align-items:center;
    padding:0 10px;
    color:#8696A0;
    font-size:10px;
    gap:6px;
  }
  .wadp-mic{
    width:26px;height:26px;border-radius:50%;
    background:#075E54;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .wadp-clip{
    width:22px; height:22px;
    display:flex; align-items:center; justify-content:center;
    color:#111B21; flex-shrink:0;
    transform:rotate(45deg);
  }
`;
