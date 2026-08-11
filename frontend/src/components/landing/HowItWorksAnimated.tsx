"use client";

import React from "react";
import { motion } from "framer-motion";

// ─── Theme tokens (matches LandingPage.tsx's CSS-var convention — see that
// file's "Design tokens" block and IntegrationDiagram's local WIRE/SURFACE
// redeclaration for precedent) ───────────────────────────────────────────────
const NAVY = "var(--color-primary)";
const BORDER = "#e2e8f0";

/* ============================================================================
   STEP 1 — CONNECT
   Icons orbit 3 concentric dashed rings around a central hub. Positions are
   trig-computed every animation frame (rAF loop tracking elapsed time),
   mirroring IntegrationDiagram's getBoundingClientRect()-driven approach but
   with continuous rotation instead of a static layout. A gentle per-icon
   scale "breathing" pulse (framer-motion) runs independently, staggered.

   Ported 1:1 from the prototype's buildOrbit(): ring radii 118/88/55,
   rotation durations 26s/19s/13s (ring1 +360°, ring2 -360°, ring3 +360°,
   linear/"none" easing == constant angular velocity), breathing pulse
   scale 1 -> 1.14, 1.1s sine.inOut yoyo, staggered 0.22s per node.
============================================================================ */

const RING1_R = 132;
const RING2_R = 98;
const RING3_R = 62;

const RING1_DURATION = 26; // seconds for a full 360° revolution
const RING2_DURATION = 19;
const RING3_DURATION = 13;

interface OrbitIcon {
  img: string;
  ring: "r1" | "r2" | "r3";
  size: number;
}

// Ring 1 (outer, 5 icons, 36px tiles), Ring 2 (middle, 5 icons, 29px tiles),
// Ring 3 (inner, 2 icons, 25px tiles) — mapping unchanged from the prototype
// (tile sizes bumped up proportionally with the larger ring radii above),
// repointed to the moved /how-it-works/ asset path (architect decision 3).
const ORBIT_ICONS: OrbitIcon[] = [
  { img: "/how-it-works/Gmail.png", ring: "r1", size: 36 },
  { img: "/how-it-works/Google calendar.png", ring: "r1", size: 36 },
  { img: "/how-it-works/Instagram.png", ring: "r1", size: 36 },
  { img: "/how-it-works/Whatsapp.png", ring: "r1", size: 36 },
  { img: "/how-it-works/Zoom.png", ring: "r1", size: 36 },
  { img: "/how-it-works/Facebook.png", ring: "r2", size: 29 },
  { img: "/how-it-works/Hubspot.png", ring: "r2", size: 29 },
  { img: "/how-it-works/Microsoft teams.png", ring: "r2", size: 29 },
  { img: "/how-it-works/Salesforce.png", ring: "r2", size: 29 },
  { img: "/how-it-works/Slack.png", ring: "r2", size: 29 },
  { img: "/how-it-works/Drive.png", ring: "r3", size: 25 },
  { img: "/how-it-works/Messenger.png", ring: "r3", size: 25 },
];

const RING_RADIUS: Record<OrbitIcon["ring"], number> = { r1: RING1_R, r2: RING2_R, r3: RING3_R };
// Angle step per icon, computed per-ring so each ring's icons are evenly spaced.
const ringCounts = ORBIT_ICONS.reduce<Record<string, number>>((acc, icon) => {
  acc[icon.ring] = (acc[icon.ring] ?? 0) + 1;
  return acc;
}, {});
const ringIndices: Record<string, number> = {};

interface OrbitNode extends OrbitIcon {
  angle: number;
  radius: number;
}

const ORBIT_NODES: OrbitNode[] = ORBIT_ICONS.map((icon) => {
  const idx = ringIndices[icon.ring] ?? 0;
  ringIndices[icon.ring] = idx + 1;
  const count = ringCounts[icon.ring] ?? 1;
  return { ...icon, angle: (360 / count) * idx, radius: RING_RADIUS[icon.ring] };
});

export function ConnectAnimation() {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const wrapRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    let cancelled = false;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const rect = stageEl.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const elapsed = (now - start) / 1000; // seconds

      const rot = prefersReducedMotion
        ? { r1: 0, r2: 0, r3: 0 }
        : {
            r1: (elapsed / RING1_DURATION) * 360,
            r2: -(elapsed / RING2_DURATION) * 360,
            r3: (elapsed / RING3_DURATION) * 360,
          };

      ORBIT_NODES.forEach((n, i) => {
        const el = wrapRefs.current[i];
        if (!el) return;
        const a = ((n.angle + rot[n.ring]) * Math.PI) / 180;
        const x = cx + n.radius * Math.cos(a) - n.size / 2;
        const y = cy + n.radius * Math.sin(a) - n.size / 2;
        el.style.transform = `translate(${x}px,${y}px)`;
      });

      if (!prefersReducedMotion) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onResize = () => {
      // Positions are recomputed every frame from live getBoundingClientRect(),
      // so no rebuild is needed on resize — the running rAF loop already
      // adapts (matches IntegrationDiagram's resize-safe measurement intent).
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={stageRef} className="relative w-full h-full">
      {/* 3 concentric dashed rings */}
      {[RING1_R, RING2_R, RING3_R].map((r) => (
        <div
          key={r}
          className="absolute top-1/2 left-1/2 rounded-full border-2 border-dashed"
          style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderColor: "#cbd5e1" }}
        />
      ))}

      {/* No center hub element — orbiting icons circle empty space, per user
          correction (nothing, not even an empty box, renders at the center). */}

      {/* Orbiting icon tiles */}
      {ORBIT_NODES.map((n, i) => (
        <div
          key={n.img}
          ref={(el) => { wrapRefs.current[i] = el; }}
          className="absolute top-0 left-0"
          style={{ width: n.size, height: n.size }}
        >
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-[6px] bg-white flex items-center justify-center"
            style={{ borderRadius: Math.max(2, n.size * 0.3), boxShadow: "0 3px 8px rgba(2,6,23,0.1)" }}
            animate={{ scale: [1, 1.14, 1] }}
            transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, delay: i * 0.22 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={n.img}
              alt=""
              style={{ width: "72%", height: "72%", objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            />
          </motion.div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   STEP 2 — CUSTOMIZE
   5 rows (Doctors/Services/Timings/FAQs/Insurance) fade/slide in (staggered),
   then animated dots travel one-by-one along SVG bezier paths from each row
   into the central "AI Assistant" brain icon. Brain pops + "Trained & Ready"
   pill appears once the last dot lands, holds, then the whole sequence loops.

   Paths are computed from live DOM measurements (getBoundingClientRect(),
   same approach as IntegrationDiagram's drawWires()). Dot travel uses native
   SVG <animateMotion> keyed to the same path `d` string (this codebase's
   established browser-native replacement for GSAP's getPointAtLength +
   onUpdate dot-chasing — see IntegrationDiagram's ambient pulse dots), with a
   sequential `begin` offset per dot so they fire one after another rather
   than all at once, matching the prototype's timeline chain.
============================================================================ */

interface CustomizeRow {
  key: string;
  color: string;
  bg: string;
  title: string;
  sub: string;
  path: string;
}

const CUSTOMIZE_ROWS: CustomizeRow[] = [
  {
    key: "doctors",
    color: "#2563eb",
    bg: "#dbeafe",
    title: "Doctors",
    sub: "Profiles & specialities",
    path: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z",
  },
  {
    key: "services",
    color: "#16a34a",
    bg: "#dcfce7",
    title: "Services",
    sub: "Departments & treatments",
    path: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM10 6h4M10 10h4M10 14h4M10 18h4",
  },
  {
    key: "timings",
    color: "#7c3aed",
    bg: "#ede9fe",
    title: "Timings",
    sub: "OPD & availability",
    path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2",
  },
  {
    key: "faqs",
    color: "#ca8a04",
    bg: "#fef9c3",
    title: "FAQs",
    sub: "Patient guidance",
    path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  },
  {
    key: "insurance",
    color: "#dc2626",
    bg: "#fee2e2",
    title: "Insurance",
    sub: "Partners & policies",
    path: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Zm-11 -1 2 2 4-4",
  },
];

const CUSTOMIZE_DOT_TRAVEL_DUR = 0.9; // seconds, matches prototype's power1.inOut 0.9s
const CUSTOMIZE_DOT_STAGGER = 0.85; // matches ">-0.05" chaining across ~0.9s legs

export function CustomizeAnimation() {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const rowRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const brainRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = React.useState<string[]>([]);
  const [pillVisible, setPillVisible] = React.useState(false);
  const [brainPulseKey, setBrainPulseKey] = React.useState(0);
  // Dot transforms are driven imperatively every frame (see the rAF loop
  // below) via setAttribute, same approach as GoLiveAnimation's signal
  // dots — SMIL (<animateMotion>/<animate>) proved unreliable here once
  // dots were remounted repeatedly by React: the browser's SMIL timeline
  // would go stale or never (re)start on some cycles, leaving dots invisible.
  const dotRefs = React.useRef<(SVGCircleElement | null)[]>([]);
  const pathElRefs = React.useRef<(SVGPathElement | null)[]>([]);

  React.useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    const brain = brainRef.current;
    if (!stage || !svg || !brain) return;

    const build = () => {
      const stageRect = stage.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
      const brainRect = brain.getBoundingClientRect();
      // Land at the circle's actual center point, inset by its radius minus
      // a few px — landing exactly on the bounding-box edge reads as a gap
      // because the dashed stroke's last visible dash segment can end before
      // reaching the true edge; biting a few px into the circle guarantees
      // the line visually overlaps it regardless of dash phase.
      const brainCenterX = brainRect.left - stageRect.left + brainRect.width / 2;
      const endX = brainCenterX - brainRect.width / 2 + 6;
      const endY = brainRect.top - stageRect.top + brainRect.height / 2;

      const next = rowRefs.current.map((row) => {
        if (!row) return "";
        const r = row.getBoundingClientRect();
        const startX = r.right - stageRect.left;
        const startY = r.top - stageRect.top + r.height / 2;
        const c1x = startX + (endX - startX) * 0.5;
        const c2x = startX + (endX - startX) * 0.5;
        return `M${startX},${startY} C${c1x},${startY} ${c2x},${endY} ${endX},${endY}`;
      });
      setPaths(next);
    };

    // Rows only animate in (x: -10 -> 0, scale: 0.94 -> 1) once the section
    // actually scrolls into view (framer-motion's `whileInView`), which can
    // happen long after this component mounts — a mount-relative timer was
    // measuring rows while they were still sitting at their pre-animation
    // `initial` position/scale, baking that offset permanently into the
    // path. Instead, watch the stage's own viewport entry directly and
    // measure ENTRANCE_DUR_MS after *that* fires (matching the rows'
    // longest entrance: last row's delay 4*0.14=0.56s + its 0.5s duration
    // ≈ 1.06s, rounded up), then keep observing resize for later changes.
    const ENTRANCE_DUR_MS = 1200;
    let settled = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !settleTimer) {
          settleTimer = setTimeout(() => {
            settled = true;
            build();
          }, ENTRANCE_DUR_MS);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(stage);

    // Deliberately NOT using a ResizeObserver on `brain` or `stage` here:
    // the brain circle's own scale-pulse animation (and its periodic
    // key={brainPulseKey} remount) plus the rows' own pulse tweens cause
    // enough transform/layout churn that a live ResizeObserver kept
    // re-firing `build()` mid-pulse, capturing the brain at a scaled-up
    // size and making the lines visibly drift off target every cycle. This
    // layout is a static 3-column grid that only changes on a real
    // window resize/breakpoint change, so a plain resize listener alone —
    // fired once after settling — is sufficient and stable.
    const onResize = () => {
      if (settled) build();
    };
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Sequenced loop: each dot travels one-by-one along its row's path via a
  // plain rAF clock (cx/cy/opacity set imperatively via setAttribute), then
  // the brain pulses + pill reveals once the last dot lands, holds, repeats.
  const lastDotArrival = (CUSTOMIZE_ROWS.length - 1) * CUSTOMIZE_DOT_STAGGER + CUSTOMIZE_DOT_TRAVEL_DUR;
  const holdDuration = 1.8; // matches prototype's tl.to({}, { duration: 1.8 })
  const cycleDuration = lastDotArrival + holdDuration + 0.6;

  React.useEffect(() => {
    if (paths.every((p) => !p)) return;
    let cancelled = false;
    let raf = 0;
    let brainPulsed = false;
    let pillHidden = true;
    const start = performance.now();

    const setDot = (i: number, t: number, visible: boolean) => {
      const dot = dotRefs.current[i];
      const pathEl = pathElRefs.current[i];
      if (!dot || !pathEl) return;
      if (!visible) {
        dot.setAttribute("opacity", "0");
        return;
      }
      const len = pathEl.getTotalLength();
      const pt = pathEl.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
      dot.setAttribute("cx", String(pt.x));
      dot.setAttribute("cy", String(pt.y));
      dot.setAttribute("opacity", "1");
    };

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = (now - start) / 1000;
      const cycleT = elapsed % cycleDuration;

      CUSTOMIZE_ROWS.forEach((_, i) => {
        const begin = i * CUSTOMIZE_DOT_STAGGER;
        if (cycleT >= begin && cycleT <= begin + CUSTOMIZE_DOT_TRAVEL_DUR) {
          setDot(i, (cycleT - begin) / CUSTOMIZE_DOT_TRAVEL_DUR, true);
        } else {
          setDot(i, 0, false);
        }
      });

      if (cycleT >= lastDotArrival - 0.05 && !brainPulsed) {
        brainPulsed = true;
        setBrainPulseKey((k) => k + 1);
        setPillVisible(true);
        pillHidden = false;
      }
      if (cycleT >= lastDotArrival + holdDuration && !pillHidden) {
        pillHidden = true;
        setPillVisible(false);
      }
      if (cycleT < 0.05) {
        brainPulsed = false;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [paths, lastDotArrival, holdDuration, cycleDuration]);

  return (
    <div ref={stageRef} className="relative w-full h-full flex items-center px-2 py-4">
      <svg ref={svgRef} className="absolute inset-0 w-full h-full z-[1]" preserveAspectRatio="none">
        {paths.map((d, i) =>
          d ? (
            <path
              key={CUSTOMIZE_ROWS[i].key}
              ref={(el) => { pathElRefs.current[i] = el; }}
              d={d}
              fill="none"
              stroke={CUSTOMIZE_ROWS[i].color}
              strokeWidth={1.6}
              strokeDasharray="5 4"
            />
          ) : null
        )}
        {/* Traveling dots — cx/cy/opacity set imperatively every frame by
            the rAF loop above via setAttribute (not SMIL, not React state),
            so no re-render/remount can ever interrupt them mid-flight. */}
        {CUSTOMIZE_ROWS.map((row, i) => (
          <circle
            key={row.key}
            ref={(el) => { dotRefs.current[i] = el; }}
            cx={0}
            cy={0}
            r={3.5}
            fill={row.color}
            opacity={0}
          />
        ))}
      </svg>

      <div className="relative z-[2] flex flex-col gap-3 w-[62%]">
        {CUSTOMIZE_ROWS.map((row, i) => (
          <motion.div
            key={row.key}
            ref={(el) => { rowRefs.current[i] = el; }}
            className="flex items-center gap-2.5 bg-white border rounded-[10px] px-3 py-2.5"
            style={{ borderColor: BORDER }}
            initial={{ opacity: 0, x: -10, scale: 0.94 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: i * 0.14, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <motion.div
              className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: row.bg }}
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ duration: 0.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2, delay: i * 0.18 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={row.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={row.path} />
              </svg>
            </motion.div>
            <div>
              <div className="text-[12.5px] font-bold leading-tight" style={{ color: NAVY }}>{row.title}</div>
              <div className="text-[10px] whitespace-nowrap" style={{ color: "#94a3b8" }}>{row.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="absolute z-[2] flex flex-col items-center gap-2" style={{ right: "6%", top: "50%", transform: "translateY(-50%)" }}>
        <motion.div
          ref={brainRef}
          key={brainPulseKey}
          className="w-[58px] h-[58px] rounded-full bg-white flex items-center justify-center"
          style={{ border: `1px solid ${BORDER}`, boxShadow: "0 6px 18px rgba(2,6,23,0.12)" }}
          animate={{ scale: [1, 1.15, 1, 1.15, 1] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8" />
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <path d="M2 14h2M20 14h2M9 13v2M15 13v2" />
          </svg>
        </motion.div>
        <div className="text-[11px] font-bold" style={{ color: NAVY }}>AI Assistant</div>
        {/* <motion.div
          className="flex items-center gap-1 rounded-[8px] px-[9px] py-1 text-[9px] font-bold"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}
          animate={{ opacity: pillVisible ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Trained &amp; Ready
        </motion.div> */}
      </div>
    </div>
  );
}

/* ============================================================================
   STEP 3 — GO LIVE
   Play button -> robot avatar -> 3 feature cards (Calendar/Chat/User).
   Pulsing rings behind the play button, traveling signal dots along paths
   (play->bot, bot->cal, bot->chat, bot->user), cards pop on arrival, whole
   stage has a gentle synchronized breathing float. Sequence loops.

   Paths computed from live DOM measurements (same pattern as Step 2 / the
   IntegrationDiagram precedent). Dot travel is driven by a single rAF loop
   sampling path.getPointAtLength() every frame (this codebase's other dot
   animations tried native SVG <animateMotion>/<animate> instead, but with
   many dots being remounted every cycle by React, Chromium's SMIL timeline
   went stale/never restarted on some cycles — a plain rAF clock has no such
   failure mode). Sequenced per the prototype's timeline: signal 1 (play->bot)
   at 0.2s/0.75s duration, then signals 2-4 fire together once signal 1
   lands, then cards pop, then a 1.5s hold before looping.
============================================================================ */

const LIVE_SIGNAL1_BEGIN = 0.2;
const LIVE_SIGNAL1_DUR = 0.75;
const LIVE_SIGNAL234_BEGIN = LIVE_SIGNAL1_BEGIN + LIVE_SIGNAL1_DUR + 0.05; // "+=0.05" after signal 1 lands
const LIVE_SIGNAL234_DUR = 0.8;
const LIVE_HOLD = 0.6; // reduced from 1.5s — shorten the idle gap between cycles
const LIVE_CYCLE = LIVE_SIGNAL234_BEGIN + LIVE_SIGNAL234_DUR + 0.3 + LIVE_HOLD;

export function GoLiveAnimation() {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const playRef = React.useRef<HTMLDivElement | null>(null);
  const botRef = React.useRef<HTMLDivElement | null>(null);
  const calRef = React.useRef<HTMLDivElement | null>(null);
  const chatRef = React.useRef<HTMLDivElement | null>(null);
  const userRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const [paths, setPaths] = React.useState<string[]>(["", "", "", ""]);
  const [nodes, setNodes] = React.useState<{ x: number; y: number }[]>([]);
  const [cardPopKey, setCardPopKey] = React.useState(0);
  const [botPopKey, setBotPopKey] = React.useState(0);
  // rAF-driven dot transforms, one per signal path (0 = play->bot, 1-3 =
  // bot->cal/chat/user), applied directly via ref.style.transform each frame.
  const dotRefs = React.useRef<(SVGCircleElement | null)[]>([]);
  const pathElRefs = React.useRef<(SVGPathElement | null)[]>([]);

  React.useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    const play = playRef.current;
    const bot = botRef.current;
    const cal = calRef.current;
    const chat = chatRef.current;
    const user = userRef.current;
    if (!stage || !svg || !play || !bot || !cal || !chat || !user) return;

    const build = () => {
      const stageRect = stage.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);

      const pPlay = play.getBoundingClientRect();
      const pBot = bot.getBoundingClientRect();
      const pCal = cal.getBoundingClientRect();
      const pChat = chat.getBoundingClientRect();
      const pUser = user.getBoundingClientRect();

      // -4px: pPlay is the 68px ring wrapper, but the visible green circle
      // inside it is only 60px (4px padding each side) — without this the
      // line's start point lands 4px past the circle's actual edge, in
      // visibly empty space.
      const playX = pPlay.right - stageRect.left - 4;
      const playY = pPlay.top - stageRect.top + pPlay.height / 2;

      const botLeftX = pBot.left - stageRect.left;
      const botLeftY = pBot.top - stageRect.top + pBot.height / 2;

      const rRadius = pBot.width / 2;
      const botCenterX = pBot.left - stageRect.left + rRadius;
      const botCenterY = pBot.top - stageRect.top + rRadius;

      const angleTop = (-40 * Math.PI) / 180;
      const botTopX = botCenterX + rRadius * Math.cos(angleTop);
      const botTopY = botCenterY + rRadius * Math.sin(angleTop);

      const botMidX = botCenterX + rRadius;
      const botMidY = botCenterY;

      const angleBot = (40 * Math.PI) / 180;
      const botBotX = botCenterX + rRadius * Math.cos(angleBot);
      const botBotY = botCenterY + rRadius * Math.sin(angleBot);

      const calX = pCal.left - stageRect.left;
      const calY = pCal.top - stageRect.top + pCal.height / 2;
      const chatX = pChat.left - stageRect.left;
      const chatY = pChat.top - stageRect.top + pChat.height / 2;
      const userX = pUser.left - stageRect.left;
      const userY = pUser.top - stageRect.top + pUser.height / 2;

      // Forced perfectly horizontal (uses botLeftY, the bot circle's own
      // true vertical center, for both ends) — the play-button column sits
      // above the LIVE badge, so `playY` (that column's own center) doesn't
      // line up with the bot circle's center, which made this line render
      // as a shallow diagonal instead of straight across.
      const d1 = `M${playX},${botLeftY} L${botLeftX},${botLeftY}`;

      const c1x1 = botTopX + (calX - botTopX) * 0.45;
      const d2 = `M${botTopX},${botTopY} C${c1x1},${botTopY} ${c1x1},${calY} ${calX},${calY}`;

      // Forced perfectly horizontal (uses botMidY for both ends, ignoring
      // chatY) — the play-button column and the 3-card column have slightly
      // different stack heights, so their flex-centered midpoints don't
      // land on exactly the same Y as the bot circle's center, which was
      // making this middle line render as a shallow diagonal instead of
      // straight across.
      const d3 = `M${botMidX},${botMidY} L${chatX},${botMidY}`;

      const c2x1 = botBotX + (userX - botBotX) * 0.45;
      const d4 = `M${botBotX},${botBotY} C${c2x1},${botBotY} ${c2x1},${userY} ${userX},${userY}`;

      setPaths([d1, d2, d3, d4]);
      setNodes([
        { x: botLeftX, y: botLeftY },
        { x: botTopX, y: botTopY },
        { x: botMidX, y: botMidY },
        { x: botBotX, y: botBotY },
        { x: calX, y: calY },
        { x: chatX, y: botMidY },
        { x: userX, y: userY },
      ]);
    };

    build();
    window.addEventListener("resize", build);
    return () => window.removeEventListener("resize", build);
  }, []);

  React.useEffect(() => {
    if (paths.every((p) => !p)) return;
    let cancelled = false;
    let raf = 0;
    let botPopped = false;
    let cardsPopped = false;
    const start = performance.now();

    const setDot = (i: number, t: number, visible: boolean) => {
      const dot = dotRefs.current[i];
      const pathEl = pathElRefs.current[i];
      if (!dot || !pathEl) return;
      if (!visible) {
        dot.setAttribute("opacity", "0");
        return;
      }
      const len = pathEl.getTotalLength();
      const pt = pathEl.getPointAtLength(Math.max(0, Math.min(1, t)) * len);
      dot.setAttribute("cx", String(pt.x));
      dot.setAttribute("cy", String(pt.y));
      dot.setAttribute("opacity", "1");
    };

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = (now - start) / 1000;
      const cycleT = elapsed % LIVE_CYCLE;

      // Signal 1: play -> bot
      if (cycleT >= LIVE_SIGNAL1_BEGIN && cycleT <= LIVE_SIGNAL1_BEGIN + LIVE_SIGNAL1_DUR) {
        setDot(0, (cycleT - LIVE_SIGNAL1_BEGIN) / LIVE_SIGNAL1_DUR, true);
      } else {
        setDot(0, 0, false);
      }

      // Bot pops once, right as signal 1 lands
      if (cycleT >= LIVE_SIGNAL1_BEGIN + LIVE_SIGNAL1_DUR - 0.05 && !botPopped) {
        botPopped = true;
        setBotPopKey((k) => k + 1);
      }

      // Signals 2-4: bot -> cards, fire together
      if (cycleT >= LIVE_SIGNAL234_BEGIN && cycleT <= LIVE_SIGNAL234_BEGIN + LIVE_SIGNAL234_DUR) {
        const t = (cycleT - LIVE_SIGNAL234_BEGIN) / LIVE_SIGNAL234_DUR;
        setDot(1, t, true);
        setDot(2, t, true);
        setDot(3, t, true);
      } else {
        setDot(1, 0, false);
        setDot(2, 0, false);
        setDot(3, 0, false);
      }

      // Cards pop once, right as signals 2-4 land
      if (cycleT >= LIVE_SIGNAL234_BEGIN + LIVE_SIGNAL234_DUR - 0.08 && !cardsPopped) {
        cardsPopped = true;
        setCardPopKey((k) => k + 1);
      }

      // Reset per-cycle pop guards once we've wrapped back to the start
      if (cycleT < LIVE_SIGNAL1_BEGIN) {
        botPopped = false;
        cardsPopped = false;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [paths]);

  return (
    <motion.div
      ref={stageRef}
      className="relative w-full h-full grid items-center p-4 overflow-hidden"
      style={{
        gridTemplateColumns: "1fr 1fr 1fr",
        background: "radial-gradient(circle at 15% 50%, #f0fdf4 0%, #ffffff 80%)",
      }}
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
    >
      <svg ref={svgRef} className="absolute inset-0 w-full h-full z-[1] pointer-events-none" preserveAspectRatio="none">
        {paths.map((d, i) =>
          d ? (
            <path
              key={i}
              ref={(el) => { pathElRefs.current[i] = el; }}
              d={d}
              fill="none"
              stroke="#86efac"
              strokeWidth={2.6}
              strokeDasharray="5 4"
            />
          ) : null
        )}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={3.5} fill="#22c55e" stroke="#ffffff" strokeWidth={1} />
        ))}
        {/* Traveling signal dots — cx/cy/opacity set imperatively every frame
            by the rAF loop above via setAttribute (not SMIL, not React state)
            so no re-render/remount can ever interrupt them mid-flight. */}
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            ref={(el) => { dotRefs.current[i] = el; }}
            cx={0}
            cy={0}
            r={4}
            fill="#22c55e"
            opacity={0}
          />
        ))}
      </svg>

      {/* LEFT: play button + LIVE badge. The play-button circle is pinned to
          the stage's absolute vertical center (top: 50%) independent of the
          LIVE badge below it — previously both sat in one flex-column, so
          the badge's height pulled that column's flex-centered midpoint down
          below the circle's own true center, offsetting it from the robot
          circle's center (which has nothing else sharing its column) and
          making the connecting line render as a diagonal instead of level. */}
      <div className="relative z-[2] flex flex-col items-start justify-self-start" style={{ height: "100%" }}>
        <div
          className="absolute flex items-center justify-center"
          style={{ width: 68, height: 68, top: "50%", left: 0, transform: "translateY(-50%)" }}
          ref={playRef}
        >
          {[
            { size: 104, bg: "rgba(34,197,94,0.06)", delay: 0 },
            { size: 86, bg: "rgba(34,197,94,0.12)", delay: 0.7 },
            { size: 70, bg: "rgba(34,197,94,0.20)", delay: 1.4 },
          ].map((ring, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{ width: ring.size, height: ring.size, background: ring.bg }}
              animate={{ scale: [1, 1.45], opacity: [1, 0] }}
              transition={{ duration: 2.2, ease: "easeOut", repeat: Infinity, delay: ring.delay }}
            />
          ))}
          <div
            className="relative z-[2] flex items-center justify-center rounded-full"
            style={{ width: 60, height: 60, background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 8px 20px rgba(34,197,94,0.38)" }}
          >
            <div className="flex items-center justify-center rounded-full bg-white" style={{ width: 36, height: 36, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#16a34a" style={{ marginLeft: 2 }}>
                <path d="M7 4v16l13-8z" />
              </svg>
            </div>
          </div>
        </div>
        <div
          className="absolute z-[2] flex items-center gap-1.5 rounded-full bg-white px-[11px] py-1"
          style={{ border: "1px solid #bbf7d0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", top: "calc(50% + 48px)", left: 0 }}
        >
          <motion.span
            className="rounded-full"
            style={{ width: 7, height: 7, background: "#22c55e" }}
            animate={{ boxShadow: ["0 0 6px #22c55e", "0 0 0 5px rgba(34,197,94,0.3)", "0 0 6px #22c55e"] }}
            transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
          />
          <span className="text-[10.5px] font-extrabold tracking-[0.04em]" style={{ color: "#16a34a" }}>LIVE</span>
        </div>
      </div>

      {/* CENTER: robot avatar */}
      <div className="relative z-[2] flex items-center justify-center justify-self-center">
        <motion.div
          ref={botRef}
          key={botPopKey}
          className="relative flex items-center justify-center rounded-full bg-white"
          style={{ width: 66, height: 66, border: "1.5px solid #bbf7d0", boxShadow: "0 8px 24px rgba(34,197,94,0.14)" }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/how-it-works/icon-robot.png"
            alt=""
            style={{ width: 44, height: 44, objectFit: "contain" }}
          />
        </motion.div>
      </div>

      {/* RIGHT: 3 feature cards */}
      <div className="relative z-[2] flex flex-col gap-3 justify-self-end">
        <motion.div
          ref={calRef}
          key={`cal-${cardPopKey}`}
          className="flex items-center justify-center rounded-[14px] bg-white"
          style={{ width: 50, height: 50, border: "1px solid #f1f5f9", boxShadow: "0 6px 18px rgba(2,6,23,0.08)" }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="6" width="24" height="22" rx="5" fill="#ffffff" stroke="#16a34a" strokeWidth="2.2" />
            <path d="M4 11 H28" stroke="#16a34a" strokeWidth="2.2" />
            <path d="M9 3 V7 M23 3 V7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="10" cy="16" r="1.4" fill="#16a34a" />
            <circle cx="16" cy="16" r="1.4" fill="#16a34a" />
            <circle cx="22" cy="16" r="1.4" fill="#16a34a" />
            <circle cx="10" cy="21" r="1.4" fill="#16a34a" />
            <circle cx="16" cy="21" r="1.4" fill="#16a34a" />
            <circle cx="23" cy="22" r="6" fill="#16a34a" />
            <path d="M20 22 L22 24 L26 20" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <motion.div
          ref={chatRef}
          key={`chat-${cardPopKey}`}
          className="flex items-center justify-center rounded-[14px] bg-white"
          style={{ width: 50, height: 50, border: "1px solid #f1f5f9", boxShadow: "0 6px 18px rgba(2,6,23,0.08)" }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.06 }}
        >
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="howItWorksChatBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <path d="M5 8 C5 5.5 7 3.5 9.5 3.5 H22.5 C25 3.5 27 5.5 27 8 V17 C27 19.5 25 21.5 22.5 21.5 H12.5 L6 26.5 V8 Z" fill="url(#howItWorksChatBlueGrad)" />
            <circle cx="11.5" cy="12.5" r="1.6" fill="#ffffff" />
            <circle cx="16" cy="12.5" r="1.6" fill="#ffffff" />
            <circle cx="20.5" cy="12.5" r="1.6" fill="#ffffff" />
          </svg>
        </motion.div>
        <motion.div
          ref={userRef}
          key={`user-${cardPopKey}`}
          className="flex items-center justify-center rounded-[14px] bg-white"
          style={{ width: 50, height: 50, border: "1px solid #f1f5f9", boxShadow: "0 6px 18px rgba(2,6,23,0.08)" }}
          animate={{ scale: [1, 1.16, 1] }}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.12 }}
        >
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="howItWorksUserPurpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9333ea" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="11" r="5" stroke="url(#howItWorksUserPurpGrad)" strokeWidth="2.4" fill="none" />
            <path d="M7 26 C7 20.8 11 18.8 16 18.8 C21 18.8 25 20.8 25 26" stroke="url(#howItWorksUserPurpGrad)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
