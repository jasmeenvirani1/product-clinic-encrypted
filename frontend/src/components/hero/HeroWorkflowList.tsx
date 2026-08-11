"use client";

import React from "react";
import { motion } from "framer-motion";
import type { HeroWorkflowStep } from "@/services/hero.service";

const NAVY = "var(--color-primary)";
const navyAlpha = (a: number) => `rgba(var(--color-primary-rgb), ${a})`;

interface Props {
  steps: HeroWorkflowStep[];
  /** Time each step stays highlighted before advancing (ms). */
  stepIntervalMs?: number;
  active?: boolean;
  /** Fired once the last step has been highlighted (after a short hold). The
   *  slider uses this to advance, so every step (incl. the last) is shown. */
  onCycleComplete?: () => void;
}

/**
 * "Automated Workflow" list that highlights each step one-by-one on a timer.
 * When it reaches the last step it holds briefly, then either signals the
 * slider to advance (onCycleComplete) or loops back to the first step.
 * (Floating badges are rendered by HeroSlider so they appear on every slide.)
 */
export function HeroWorkflowList({ steps, stepIntervalMs = 2200, active = true, onCycleComplete }: Props) {
  const [activeIdx, setActiveIdx] = React.useState(0);

  const onDoneRef = React.useRef(onCycleComplete);
  React.useEffect(() => { onDoneRef.current = onCycleComplete; }, [onCycleComplete]);

  React.useEffect(() => {
    if (!active || steps.length === 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const interval = Math.max(600, stepIntervalMs);

    const step = (index: number) => {
      if (cancelled) return;
      setActiveIdx(index);

      if (index >= steps.length - 1) {
        // Last step reached — keep it highlighted for one interval (like every
        // other step), then switch on the spot / loop. No extra hold.
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            if (onDoneRef.current) onDoneRef.current();
            else step(0);
          }, interval)
        );
        return;
      }
      timers.push(setTimeout(() => step(index + 1), interval));
    };

    step(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [steps.length, stepIntervalMs, active]);

  return (
    <div className="relative min-h-[300px] lg:min-h-[220px] pt-1">
      <h3 className="font-heading text-xl font-semibold mb-5" style={{ color: NAVY }}>
        Automated Workflow
      </h3>

      <div className="flex flex-col gap-2.5">
        {steps.map((step, i) => {
          const isActive = i === activeIdx;
          return (
            <motion.div
              key={`${step.order}-${step.label}`}
              animate={{
                backgroundColor: isActive ? NAVY : "rgb(248 250 252)",
                scale: isActive ? 1.02 : 1,
              }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <span
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14.5px] font-bold"
                style={
                  isActive
                    ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                    : { background: navyAlpha(0.1), color: NAVY }
                }
              >
                {step.order}
              </span>
              <span
                className="text-[15.5px] font-medium"
                style={{ color: isActive ? "#fff" : "var(--color-brand-heading)" }}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
