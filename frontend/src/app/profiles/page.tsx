import Link from "next/link";
import type { Metadata } from "next";
import { getAllProfiles } from "@/data/profiles.mock";
import PublicProfileCard from "@/components/profiles/PublicProfileCard";

export const metadata: Metadata = {
  title: "Profiles",
  description: "Browse all clinic profiles and their videos.",
};

export default function ProfilesListingPage() {
  const profiles = getAllProfiles();

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
