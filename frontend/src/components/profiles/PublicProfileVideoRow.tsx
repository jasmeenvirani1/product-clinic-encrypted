"use client";

import type { PublicProfileVideo } from "@/data/profiles.mock";
import PublicProfileVideoCard from "./PublicProfileVideoCard";

interface PublicProfileVideoRowProps {
  videos: PublicProfileVideo[];
}

/**
 * Horizontally scrollable row of portrait video thumbnails, positioned
 * above the rest of the profile detail content (Instagram reels-row style).
 * Scrolls within its own container only — never causes page-body horizontal
 * scroll.
 */
export default function PublicProfileVideoRow({ videos }: PublicProfileVideoRowProps) {
  if (videos.length === 0) {
    return (
      <p className="text-sm text-slate-500">No videos uploaded yet.</p>
    );
  }

  return (
    <div className="-mx-6 max-w-full overflow-x-auto px-6 pb-2 sm:mx-0 sm:px-0">
      <div className="flex w-max snap-x gap-3 sm:w-auto sm:grid sm:grid-cols-4 sm:gap-4">
        {videos.map((video) => (
          <PublicProfileVideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}
