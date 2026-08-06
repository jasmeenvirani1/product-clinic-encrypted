"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Briefcase, ChevronRight, GraduationCap, Globe, MapPin, Tag } from "lucide-react";
import type { PublicProfile } from "@/data/profiles.mock";
import { formatCount, formatJoinedDate } from "@/data/profiles.mock";
import { getInitials } from "@/lib/utils";
import { useAppSelector } from "@/hooks/useAppSelector";
import { EditPublicProfileModal } from "@/components/profiles/EditPublicProfileModal";

interface PublicProfileHeaderProps {
  profile: PublicProfile;
}

/** Instagram-profile-style header: avatar+badge, name/handle, stats, Follow button, detail cards. */
export default function PublicProfileHeader({ profile }: PublicProfileHeaderProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const loggedInUsername = useAppSelector((state) => state.auth.user?.username);
  // Only a non-null username match counts as ownership — a logged-in user with
  // username: null must never be treated as the owner of a profile whose route
  // param happens to be a username (different identifier types).
  const isOwner = !!loggedInUsername && loggedInUsername === profile.username;

  const videoCount = profile.videos.length;
  const totalViews = profile.videos.reduce((sum, v) => sum + v.views, 0);
  const totalLikes = profile.videos.reduce((sum, v) => sum + v.likes, 0);
  const joined = formatJoinedDate(profile.joinedDate);
  const displayName = profile.name;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar with verified badge overlapping bottom-right edge */}
      <div className="relative">
        <span
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md ring-2 ring-white ring-offset-2 ring-offset-slate-100 sm:h-28 sm:w-28"
          style={{ background: profile.avatarGradient }}
        >
          {getInitials(profile.name)}
        </span>
        {profile.verified && (
          <span
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="Verified"
          >
            <BadgeCheck size={22} className="text-primary" fill="currentColor" style={{ color: "var(--color-primary)" }} strokeWidth={1.5} />
          </span>
        )}
      </div>

      {/* Name + handle */}
      <h1 className="mt-4 font-heading text-2xl font-bold text-slate-900 sm:text-3xl">{displayName}</h1>
      {(profile.username || profile.handle) && (
        <p className="mt-1 text-sm font-medium text-slate-500">
          {profile.username ? `@${profile.username}` : profile.handle}
        </p>
      )}

      {profile.bio && <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-700">{profile.bio}</p>}

      {/* Location / website / joined */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {profile.location && (
          <span className="flex items-center gap-1">
            <MapPin size={13} /> {profile.location}
          </span>
        )}
        {profile.website && (
          <span className="flex items-center gap-1">
            <Globe size={13} /> {profile.website}
          </span>
        )}
        {joined && <span>{joined}</span>}
      </div>

      {/* Stats row — inline, not boxed */}
      <div className="mt-5 flex items-center justify-center gap-4 text-sm">
        <span className="text-slate-700">
          <span className="font-bold text-slate-900">{videoCount}</span> Videos
        </span>
        <span className="text-slate-700">
          <span className="font-bold text-slate-900">{formatCount(totalViews)}</span> Views
        </span>
        <span className="text-slate-700">
          <span className="font-bold text-slate-900">{formatCount(totalLikes)}</span> Liked
        </span>
      </div>

      {/* Action row — single prominent Follow button, or Edit Profile for owner */}
      <div className="mt-4 w-full max-w-xs">
        {isOwner ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-full rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ background: "var(--color-primary)" }}
            aria-label="Edit your profile"
          >
            Edit Profile
          </button>
        ) : (
          // Visual only, non-functional — shown to non-owner viewers
          <button
            type="button"
            className="w-full rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ background: "var(--color-primary)" }}
          >
            Follow
          </button>
        )}
      </div>

      {/* Education / Professional / Services detail cards */}
      <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"
            style={{ color: "var(--color-primary)" }}
          >
            <GraduationCap size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-900">Education Details</span>
            <span className="block truncate text-xs text-slate-500">
              {profile.education || "No education details yet"}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </button>

        <button
          type="button"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"
            style={{ color: "var(--color-primary)" }}
          >
            <Briefcase size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-900">Professional Details</span>
            <span className="block truncate text-xs text-slate-500">
              {profile.experience || "No professional details yet"}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </button>

        <button
          type="button"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"
            style={{ color: "var(--color-primary)" }}
          >
            <Tag size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-900">Services</span>
            {profile.category ? (
              <span className="mt-0.5 inline-block truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {profile.category}
              </span>
            ) : (
              <span className="block truncate text-xs text-slate-500">No services listed yet</span>
            )}
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </button>
      </div>

      {isOwner && (
        <EditPublicProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
