"use client";

import { Activity, Banknote, CalendarCheck, CheckCircle2, TrendingDown, TrendingUp, UserCheck, Users, UserPlus, Zap, type LucideIcon } from "lucide-react";
import type { DashboardMetric } from "../utils/types";

// ─── Deterministic sparkline data ────────────────────────────────────────────

function seededPoints(seed: number): number[] {
  // Visually interesting bar heights using the metric's value as seed.
  // Pattern is deterministic so it doesn't flicker on re-render.
  const bases = [0.35, 0.55, 0.42, 0.68, 0.50, 0.75, 0.60, 0.80];
  return bases.map((v, i) => {
    const jitter = ((seed * (i + 3) * 13) % 23) / 100;
    return Math.min(0.95, Math.max(0.18, v + jitter));
  });
}

// ─── Bar sparkline (for count metrics) ───────────────────────────────────────

function BarSparkline({ seed, color }: { seed: number; color: string }) {
  const pts  = seededPoints(seed);
  const W    = 64;
  const H    = 34;
  const barW = 6;
  const gap  = 3;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {pts.map((v, i) => {
        const barH = Math.max(5, v * H);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - barH}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
            opacity={0.35 + i * 0.08}
          />
        );
      })}
    </svg>
  );
}

// ─── Line sparkline ───────────────────────────────────────────────────────────

function LineSparkline({ seed, color }: { seed: number; color: string }) {
  const pts    = seededPoints(seed);
  const W      = 80;
  const H      = 34;
  const gradId = `lg-${seed}`;
  const xs     = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys     = pts.map((v)    => H - v * H);
  const line   = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area   = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Accent config ────────────────────────────────────────────────────────────

interface AccentConfig {
  circleBg: string;   // tailwind bg class for icon circle
  hexColor:  string;  // hex for SVG charts
  Icon:      LucideIcon;
}

function getAccent(label: string): AccentConfig {
  const l = label.toLowerCase();
  if (l.includes("revenue") || l.includes("mrr") || l.includes("payment"))
    return { circleBg: "bg-emerald-500", hexColor: "#10B981", Icon: Banknote      };
  if (l.includes("lead"))
    return { circleBg: "bg-rose-500",    hexColor: "#F43F5E", Icon: UserPlus      };
  if (l.includes("conversion") || l.includes("convert"))
    return { circleBg: "bg-green-500",   hexColor: "#22C55E", Icon: TrendingUp    };
  if (l.includes("book") || l.includes("won"))
    return { circleBg: "bg-teal-500",    hexColor: "#14B8A6", Icon: CalendarCheck };
  if (l.includes("active user") || l.includes("active users"))
    return { circleBg: "bg-sky-500",     hexColor: "#0EA5E9", Icon: Activity      };
  if (l.includes("appoint") || l.includes("schedule"))
    return { circleBg: "bg-sky-500",     hexColor: "#0EA5E9", Icon: CalendarCheck };
  if (l.includes("ticket") || l.includes("support") || l.includes("resolved"))
    return { circleBg: "bg-orange-500",  hexColor: "#F97316", Icon: CheckCircle2  };
  if (l.includes("ai") || l.includes("chat") || l.includes("message"))
    return { circleBg: "bg-amber-500",   hexColor: "#F59E0B", Icon: Zap           };
  if (l.includes("tenant"))
    return { circleBg: "bg-violet-500",  hexColor: "#8B5CF6", Icon: Users         };
  if (l.includes("user") || l.includes("doctor") || l.includes("team"))
    return { circleBg: "bg-indigo-500",  hexColor: "#6366F1", Icon: UserCheck     };
  if (l.includes("patient"))
    return { circleBg: "bg-pink-500",    hexColor: "#EC4899", Icon: Users         };
  return   { circleBg: "bg-cyan-500",    hexColor: "#06B6D4", Icon: TrendingUp    };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export const KpiCard = ({ metric, index = 0 }: { metric: DashboardMetric; index?: number }) => {
  const accent  = getAccent(metric.label);
  const { Icon } = accent;
  const isUp    = metric.trend === "up";
  const isDown  = metric.trend === "down";

  // Deterministic seed from value string
  const seed = metric.value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  // card 0 & 2 → bar, card 1 & 3 → line
  const useBar = index % 2 === 0;

  // Extract a clean percentage/number from the change string
  const changeMatch   = metric.change.match(/[+\-]?\d+(\.\d+)?%?/);
  const changeDisplay = changeMatch ? changeMatch[0] : metric.change;
  const hasPlus       = isUp && !changeDisplay.startsWith("+");

  return (
    <div className="crm-card bg-white px-5 py-4 flex flex-col gap-4">
      {/* ── Row 1: icon + trend badge ── */}
      <div className="flex items-start justify-between">
        {/* Circular accent icon */}
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accent.circleBg} shadow-sm`}>
          <Icon size={22} className="text-white" />
        </div>

        {/* Trend badge + sub-label */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-bold leading-none ${
              isUp   ? "bg-emerald-500 text-white" :
              isDown ? "bg-rose-500    text-white" :
                       "bg-slate-200  text-slate-600"
            }`}
          >
            {isUp   && <TrendingUp   size={10} />}
            {isDown && <TrendingDown size={10} />}
            {hasPlus ? `+${changeDisplay}` : changeDisplay}
          </span>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">in last 7 Days</span>
        </div>
      </div>

      {/* ── Row 2: label + value  |  sparkline ── */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[13px] text-slate-500 leading-none mb-1.5">{metric.label}</p>
          <p className="text-[26px] font-bold text-slate-900 leading-none tabular-nums">{metric.value}</p>
        </div>

        <div className="shrink-0 pb-0.5">
          {useBar
            ? <BarSparkline  seed={seed} color={accent.hexColor} />
            : <LineSparkline seed={seed} color={accent.hexColor} />
          }
        </div>
      </div>
    </div>
  );
};
