"use client";

import { useRouter } from "next/navigation";
import type { PublicProfile } from "@/data/profiles.mock";
import { getInitials } from "@/lib/utils";

interface PublicProfileCardProps {
  profile: PublicProfile;
}

/** Instagram-explore-style profile card: circular avatar, name, category. */
export default function PublicProfileCard({ profile }: PublicProfileCardProps) {
  const router = useRouter();
  const displayName = profile.name;

  return (
    <button
      type="button"
      onClick={() => router.push(`/profiles/${profile.slug}`)}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full text-lg font-bold text-white ring-2 ring-white ring-offset-2 ring-offset-slate-100 shadow-md"
        style={{ background: profile.avatarGradient }}
      >
        {getInitials(profile.name)}
      </span>
      <span className="w-full">
        <span className="block truncate font-heading text-base font-semibold text-slate-900 group-hover:text-primary">
          {displayName}
        </span>
        {profile.username && (
          <span className="block truncate text-xs text-slate-500">@{profile.username}</span>
        )}
        <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {profile.category}
        </span>
      </span>
    </button>
  );
}
