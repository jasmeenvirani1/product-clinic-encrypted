import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { APP_TAGLINE } from "@/constants/brand";
import { getPlatformBrand } from "@/lib/getPlatformBrand";

interface PublicSpecialityDetail {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  short_description: string | null;
  detail_content: string | Record<string, unknown> | null;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
}

interface DetailBlock {
  type?: string;
  text?: string;
  items?: string[];
  [key: string]: unknown;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getSpeciality(slug: string): Promise<PublicSpecialityDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/public/specialities/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null; // data: null on miss — same check covers both cases
  } catch {
    return null; // network error/timeout — same "not found" path
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const speciality = await getSpeciality(params.slug);
  const brand = await getPlatformBrand();
  // Fail-open: generic site defaults if fetch failed or slug not found — generateMetadata
  // cannot short-circuit rendering, so the page body below is the single source of
  // truth for the 404 decision.
  const title = speciality?.meta_title || speciality?.name || brand.fullName;
  const description = speciality?.meta_description || speciality?.short_description || APP_TAGLINE;
  const hasOg = !!(speciality?.og_title || speciality?.og_description || speciality?.og_image);

  return {
    title,
    description,
    ...(hasOg
      ? {
          openGraph: {
            title: speciality?.og_title || title,
            description: speciality?.og_description || description,
            images: speciality?.og_image ? [speciality.og_image] : undefined,
          },
        }
      : {}),
    ...(speciality?.canonical_url
      ? {
          alternates: {
            canonical: speciality.canonical_url,
          },
        }
      : {}),
  };
}

// Defensive renderer for the schema-less detail_content JSONB column. Supports at
// minimum a `{ blocks: [{ type: "heading" | "paragraph" | "list", text/items }] }`
// shape, skipping any block that doesn't match a known shape rather than throwing.
function renderDetailBlocks(detailContent: Record<string, unknown> | null): React.ReactNode[] | null {
  const blocks = (detailContent as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const rendered: React.ReactNode[] = [];

  blocks.forEach((raw, i) => {
    const block = raw as DetailBlock;
    if (!block || typeof block !== "object") return;

    if (block.type === "heading" && typeof block.text === "string" && block.text.trim()) {
      rendered.push(
        <h2 key={i} className="text-2xl font-bold text-slate-900 mt-8 mb-3 first:mt-0">
          {block.text}
        </h2>,
      );
    } else if (block.type === "paragraph" && typeof block.text === "string" && block.text.trim()) {
      rendered.push(
        <p key={i} className="text-slate-700 leading-relaxed mb-4">
          {block.text}
        </p>,
      );
    } else if (block.type === "list" && Array.isArray(block.items) && block.items.length > 0) {
      rendered.push(
        <ul key={i} className="list-disc pl-6 mb-4 text-slate-700 space-y-1.5">
          {block.items
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item, j) => (
              <li key={j}>{item}</li>
            ))}
        </ul>,
      );
    }
    // Unrecognized block shapes are silently skipped, not thrown.
  });

  return rendered.length > 0 ? rendered : null;
}

export default async function SpecialityDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const speciality = await getSpeciality(params.slug);
  if (!speciality) notFound();

  const brand = await getPlatformBrand();
  const isHtmlContent = typeof speciality.detail_content === "string";
  const renderedBlocks = isHtmlContent
    ? null
    : renderDetailBlocks(speciality.detail_content as Record<string, unknown> | null);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-primary hover:text-primary-dark">
          Back to {brand.name} AI
        </Link>
        <article className="mt-8 border border-slate-200 bg-white p-8 shadow-sm rounded-2xl">
          <h1 className="text-3xl font-bold text-slate-900">{speciality.name}</h1>
          {speciality.short_description && (
            <p className="mt-3 text-lg text-slate-600 leading-relaxed">{speciality.short_description}</p>
          )}
          <div className="mt-8">
            {isHtmlContent && (speciality.detail_content as string).trim() ? (
              <div
                className={
                  "max-w-none text-slate-700 leading-relaxed " +
                  "[&_img]:max-w-full [&_img]:rounded-md " +
                  "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-slate-900 [&_h1]:my-4 " +
                  "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-slate-900 [&_h2]:my-3 " +
                  "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-slate-900 [&_h3]:my-2 " +
                  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6"
                }
                dangerouslySetInnerHTML={{ __html: speciality.detail_content as string }}
              />
            ) : (
              renderedBlocks ?? (
                !speciality.short_description && (
                  <p className="text-slate-500">More details coming soon.</p>
                )
              )
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
