const INTENT_STYLE: Record<string, { bg: string; label: string }> = {
  high:    { bg: "bg-red-500",    label: "High" },
  medium:  { bg: "bg-orange-400", label: "Medium" },
  low:     { bg: "bg-slate-400",  label: "Low" },
};

export const IntentBadge = ({ intent }: { intent?: string | null }) => {
  if (!intent || intent === "unknown") return null;
  const style = INTENT_STYLE[intent];
  if (!style) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none text-white ${style.bg}`}
    >
      {style.label}
    </span>
  );
};

export const ChannelAvatarBadge = ({ channel }: { channel: string }) => {
  if (channel === "WhatsApp") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full shadow"
        style={{ width: 18, height: 18, background: "#25D366" }}
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="white">
          <path d="M12.031 2C6.547 2 2.098 6.449 2.098 11.933c0 1.749.457 3.384 1.252 4.814L2 22l5.39-1.413a10.003 10.003 0 0 0 4.641 1.147C17.515 21.734 22 17.25 22 11.733 22 6.224 17.515 2 12.031 2zm4.719 13.23c-.197.556-1.16 1.063-1.601 1.099-.442.036-.857.22-2.888-.602-2.446-.985-3.97-3.448-4.09-3.607-.121-.158-1.009-1.341-1.009-2.559 0-1.218.64-1.82.866-2.066.226-.246.493-.308.658-.308s.329.003.473.009c.152.006.355-.058.555.422.2.48.682 1.663.742 1.783.059.12.099.26.019.42-.079.16-.119.26-.236.399-.118.14-.25.313-.356.42-.118.12-.241.25-.103.49.138.24.613 1.01 1.316 1.635.905.807 1.668 1.057 1.904 1.177.236.12.374.1.512-.06.138-.16.59-.688.748-.923.157-.236.314-.197.531-.119.217.079 1.383.652 1.62.771.238.12.396.179.455.278.059.099.059.575-.138 1.13z" />
        </svg>
      </span>
    );
  }

  if (channel === "Instagram") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center overflow-hidden rounded-full shadow"
        style={{
          width: 18,
          height: 18,
          background:
            "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="white" stroke="none" />
        </svg>
      </span>
    );
  }

  if (channel === "Messenger") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full shadow"
        style={{
          width: 18,
          height: 18,
          background: "linear-gradient(135deg, #0099FF 0%, #A033FF 60%, #FF5C87 100%)",
        }}
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="white">
          <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.84 1.356 5.38 3.506 7.097v3.487l3.196-1.744A11.2 11.2 0 0 0 12 21.5c5.523 0 10-4.144 10-9.241S17.523 2 12 2zm.923 11.02-2.307-2.46L5.992 13.4l5.127-5.44 2.357 2.46 4.57-2.46-5.123 5.06z" />
        </svg>
      </span>
    );
  }

  return null;
};

export const ChannelHeaderBadge = ({ channel }: { channel: string }) => {
  if (channel === "WhatsApp") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full shadow"
        style={{ width: 20, height: 20, background: "#25D366" }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
          <path d="M12.031 2C6.547 2 2.098 6.449 2.098 11.933c0 1.749.457 3.384 1.252 4.814L2 22l5.39-1.413a10.003 10.003 0 0 0 4.641 1.147C17.515 21.734 22 17.25 22 11.733 22 6.224 17.515 2 12.031 2zm4.719 13.23c-.197.556-1.16 1.063-1.601 1.099-.442.036-.857.22-2.888-.602-2.446-.985-3.97-3.448-4.09-3.607-.121-.158-1.009-1.341-1.009-2.559 0-1.218.64-1.82.866-2.066.226-.246.493-.308.658-.308s.329.003.473.009c.152.006.355-.058.555.422.2.48.682 1.663.742 1.783.059.12.099.26.019.42-.079.16-.119.26-.236.399-.118.14-.25.313-.356.42-.118.12-.241.25-.103.49.138.24.613 1.01 1.316 1.635.905.807 1.668 1.057 1.904 1.177.236.12.374.1.512-.06.138-.16.59-.688.748-.923.157-.236.314-.197.531-.119.217.079 1.383.652 1.62.771.238.12.396.179.455.278.059.099.059.575-.138 1.13z" />
        </svg>
      </span>
    );
  }

  if (channel === "Instagram") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center overflow-hidden rounded-full shadow"
        style={{
          width: 20,
          height: 20,
          background:
            "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="white" stroke="none" />
        </svg>
      </span>
    );
  }

  if (channel === "Web Chat") {
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full shadow bg-slate-400"
        style={{ width: 20, height: 20 }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </span>
    );
  }

  return null;
};
