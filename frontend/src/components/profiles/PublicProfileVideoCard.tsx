"use client";

import { Eye, Heart, Play } from "lucide-react";
import type { PublicProfileVideo } from "@/data/profiles.mock";
import { formatCount } from "@/data/profiles.mock";
import { cn } from "@/lib/utils";

interface PublicProfileVideoCardProps {
  video: PublicProfileVideo;
  className?: string;
}

/**
 * Tall 9:16 portrait video thumbnail card, Instagram-reels style:
 * eye icon + view count overlaid bottom-left, heart icon + like count
 * next to it. Defaults to a fixed width for horizontal-scroll-row usage;
 * pass className="w-full" (grid usage) to have it fill its grid cell instead.
 */
export default function PublicProfileVideoCard({ video, className }: PublicProfileVideoCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-64 w-36 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200 sm:h-72 sm:w-40",
        className,
      )}
      style={{ background: video.thumbnailGradient }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-white/70">
        <Play size={28} strokeWidth={1.5} fill="currentColor" />
      </span>
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />
      <div className="relative z-10 flex items-center gap-2.5 p-2.5 text-white">
        <span className="flex items-center gap-1 text-xs font-semibold drop-shadow">
          <Eye size={14} strokeWidth={2} />
          {formatCount(video.views)}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold drop-shadow">
          <Heart size={14} strokeWidth={2} fill="currentColor" />
          {formatCount(video.likes)}
        </span>
      </div>
    </div>
  );
}
