import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PublicProfile } from "@/data/profiles.mock";
import type { PublicClinicDetail } from "@/services/clinic.service";
import PublicProfileHeader from "@/components/profiles/PublicProfileHeader";
import PublicProfileVideoGrid from "@/components/profiles/PublicProfileVideoGrid";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getClinicByUsername(username: string): Promise<PublicClinicDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/public/clinics/${encodeURIComponent(username)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null; // data: null on miss (unknown or non-public username)
  } catch {
    return null; // network error/timeout — same "not found" path
  }
}

// Maps the real API detail shape into the existing PublicProfile shape so
// PublicProfileHeader/PublicProfileVideoGrid need zero prop-shape changes.
function toPublicProfile(clinic: PublicClinicDetail): PublicProfile {
  return {
    slug: clinic.slug,
    name: clinic.name,
    category: clinic.category,
    avatarGradient: clinic.avatarGradient,
    bio: clinic.bio,
    location: clinic.location,
    handle: clinic.handle,
    website: clinic.website,
    verified: clinic.verified,
    joinedDate: clinic.joinedDate,
    videos: [],
    username: clinic.username,
    experience: clinic.experience ?? "",
    education: clinic.education ?? "",
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const clinic = await getClinicByUsername(params.slug);
  return {
    title: clinic ? clinic.name : "Profile not found",
    description: clinic?.bio || undefined,
  };
}

export default async function ProfileDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const clinic = await getClinicByUsername(params.slug);
  if (!clinic) notFound();

  const profile = toPublicProfile(clinic);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/profiles" className="text-sm font-semibold text-primary hover:text-primary-dark">
          &larr; Back to Profiles
        </Link>

        <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Profile header — photo, name, category, stats, bio, details, actions */}
          <PublicProfileHeader profile={profile} />

          {/* Videos — below the profile header */}
          <section aria-label="Videos" className="mt-10 border-t border-slate-100 pt-8">
            <h2 className="mb-4 font-heading text-lg font-bold text-slate-900">Videos</h2>
            <PublicProfileVideoGrid videos={profile.videos} />
          </section>
        </article>
      </div>
    </main>
  );
}
