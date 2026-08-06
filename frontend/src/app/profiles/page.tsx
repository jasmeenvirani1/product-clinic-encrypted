import Link from "next/link";
import type { Metadata } from "next";
import PublicProfileCard from "@/components/profiles/PublicProfileCard";
import type { PublicProfile } from "@/data/profiles.mock";
import type { PublicClinicSummary } from "@/services/clinic.service";

export const metadata: Metadata = {
  title: "Profiles",
  description: "Browse all clinic profiles and their videos.",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getAllClinics(): Promise<PublicClinicSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/public/clinics`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return []; // network error/timeout — same "no profiles" empty state
  }
}

// Maps the real API summary shape into the existing PublicProfile shape so
// PublicProfileCard (which only reads slug/name/username/category/avatarGradient)
// needs zero changes. Video-derived fields aren't used by the card, so they're
// filled with empty/zero placeholders.
function toPublicProfile(clinic: PublicClinicSummary): PublicProfile {
  return {
    slug: clinic.slug,
    name: clinic.name,
    category: clinic.category,
    avatarGradient: clinic.avatarGradient,
    bio: "",
    location: "",
    handle: `@${clinic.username}`,
    website: "",
    verified: false,
    joinedDate: clinic.joinedDate,
    videos: [],
    username: clinic.username,
    experience: clinic.experience ?? "",
    education: clinic.education ?? "",
  };
}

export default async function ProfilesListingPage() {
  const clinics = await getAllClinics();
  const profiles = clinics.map(toPublicProfile);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-primary hover:text-primary-dark">
          &larr; Back to home
        </Link>

        <div className="mt-6 mb-10">
          <h1 className="font-heading text-3xl font-bold text-slate-900">Profiles</h1>
          <p className="mt-2 text-slate-600">Explore clinic profiles and their videos.</p>
        </div>

        {profiles.length === 0 ? (
          <p className="text-slate-500">No profiles to show yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {profiles.map((profile) => (
              <PublicProfileCard key={profile.slug} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
