import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfileBySlug } from "@/data/profiles.mock";
import PublicProfileHeader from "@/components/profiles/PublicProfileHeader";
import PublicProfileVideoGrid from "@/components/profiles/PublicProfileVideoGrid";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const profile = getProfileBySlug(params.slug);
  return {
    title: profile ? profile.name : "Profile not found",
    description: profile?.bio,
  };
}

export default function ProfileDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = getProfileBySlug(params.slug);
  if (!profile) notFound();

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
