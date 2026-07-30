import { APP_SHORT_NAME } from "@/constants/brand";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<LogoSize, { box: string; text: string; ring: string }> = {
  xs: { box: "h-7 w-7 rounded-lg",    text: "text-[11px]", ring: "rounded-lg" },
  sm: { box: "h-8 w-8 rounded-[10px]", text: "text-[12px]", ring: "rounded-[10px]" },
  md: { box: "h-9 w-9 rounded-xl",    text: "text-[13px]", ring: "rounded-xl" },
  lg: { box: "h-10 w-10 rounded-xl",  text: "text-[15px]", ring: "rounded-xl" },
  xl: { box: "h-14 w-14 rounded-2xl", text: "text-[22px]", ring: "rounded-2xl" },
};

interface LogoMarkProps {
  size?: LogoSize;
  className?: string;
  /** Dynamic platform short name (e.g. from useThemeColors() or getPlatformBrand()).
   *  Falls back to the static APP_SHORT_NAME default if omitted. */
  shortName?: string;
}

export function LogoMark({ size = "md", className = "", shortName = APP_SHORT_NAME }: LogoMarkProps) {
  const { box, text, ring } = SIZE[size];
  return (
    <div
      className={`${box} ${ring} shrink-0 relative flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{
        background: "var(--color-primary)",
        boxShadow: "0 2px 8px rgba(var(--color-primary-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.18)",
      }}
    >
      {/* top-left glass shine */}
      <div
        className={`absolute inset-0 ${ring} pointer-events-none`}
        style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 55%)" }}
      />
      {/* subtle inner border */}
      <div
        className={`absolute inset-[1px] ${ring} pointer-events-none`}
        style={{ border: "1px solid rgba(255,255,255,0.12)" }}
      />
      <span
        className={`relative z-10 font-black tracking-tight leading-none text-white ${text}`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)", letterSpacing: "-0.03em" }}
      >
        {shortName}
      </span>
    </div>
  );
}
