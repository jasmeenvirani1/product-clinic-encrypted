"use client";

import type { PublicProfileVideo } from "@/data/profiles.mock";
import PublicProfileVideoCard from "./PublicProfileVideoCard";

interface PublicProfileVideoGridProps {
  videos: PublicProfileVideo[];
}

/**
 * Responsive Instagram-style grid of portrait video thumbnails — used as the
 * main body content on the profile detail page (below the profile header).
 * 2 cols on mobile, 3-4 cols on larger screens. Never causes page-body
 * horizontal scroll (unlike the listing-row variant).
 */
export default function PublicProfileVideoGrid({ videos }: PublicProfileVideoGridProps) {
  if (videos.length === 0) {
    return <p className="text-sm text-slate-500">No videos uploaded yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {videos.map((video) => (
        <PublicProfileVideoCard key={video.id} video={video} className="w-full" />
      ))}
    </div>
  );
}
