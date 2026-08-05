"use client";

import { BadgeCheck, Globe, MapPin } from "lucide-react";
import type { PublicProfile } from "@/data/profiles.mock";
import { formatCount, formatJoinedDate } from "@/data/profiles.mock";
import { getInitials } from "@/lib/utils";

interface PublicProfileHeaderProps {
  profile: PublicProfile;
}

/** Instagram-profile-style header: avatar + name/category + stats + bio + action row. */
export default function PublicProfileHeader({ profile }: PublicProfileHeaderProps) {
  const videoCount = profile.videos.length;
  const totalViews = profile.videos.reduce((sum, v) => sum + v.views, 0);
  const totalLikes = profile.videos.reduce((sum, v) => sum + v.likes, 0);
  const joined = formatJoinedDate(profile.joinedDate);
  const displayName = profile.name;

  return (
    <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
      <span
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md ring-2 ring-white ring-offset-2 ring-offset-slate-100 sm:h-28 sm:w-28"
        style={{ background: profile.avatarGradient }}
      >
        {getInitials(profile.name)}
      </span>

      <div className="flex-1">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
          <h1 className="flex items-center gap-1.5 font-heading text-2xl font-bold text-slate-900 sm:text-3xl">
            {displayName}
            {profile.verified && (
              <BadgeCheck size={20} className="text-primary" aria-label="Verified" />
            )}
          </h1>
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {profile.category}
          </span>
        </div>

        {(profile.username || profile.handle) && (
          <p className="mt-1 text-sm font-medium text-slate-500">
            {profile.username ? `@${profile.username}` : profile.handle}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-4 flex justify-center gap-6 sm:justify-start">
          <div className="text-center sm:text-left">
            <div className="text-lg font-bold text-slate-900">{videoCount}</div>
            <div className="text-xs text-slate-500">videos</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-lg font-bold text-slate-900">{formatCount(totalViews)}</div>
            <div className="text-xs text-slate-500">views</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-lg font-bold text-slate-900">{formatCount(totalLikes)}</div>
            <div className="text-xs text-slate-500">likes</div>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 max-w-2xl text-slate-700 leading-relaxed">{profile.bio}</p>
        )}

        {/* Location / website / joined */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate-500 sm:justify-start">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {profile.location}
            </span>
          )}
          {profile.website && (
            <span className="flex items-center gap-1">
              <Globe size={14} /> {profile.website}
            </span>
          )}
          {joined && <span>{joined}</span>}
        </div>

        {/* Experience / education */}
        {(profile.experience || profile.education) && (
          <div className="mt-3 flex flex-col items-center gap-1 text-sm text-slate-600 sm:items-start">
            {profile.experience && (
              <span>
                <span className="font-semibold text-slate-700">Experience:</span> {profile.experience}
              </span>
            )}
            {profile.education && (
              <span>
                <span className="font-semibold text-slate-700">Education:</span> {profile.education}
              </span>
            )}
          </div>
        )}

        {/* Action row — visual only, non-functional */}
        <div className="mt-5 flex justify-center gap-2 sm:justify-start">
          <button
            type="button"
            className="rounded-full px-5 py-1.5 text-sm font-semibold text-white shadow-sm"
            style={{ background: "var(--color-primary)" }}
          >
            Follow
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Message
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
