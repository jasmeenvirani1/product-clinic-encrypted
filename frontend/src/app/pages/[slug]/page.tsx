import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPagesService } from "@/services/manage-pages.service";
import { getPlatformBrand } from "@/lib/getPlatformBrand";

interface PublicManagedPageProps {
  params: { slug: string };
  searchParams?: { lang?: string };
}

export default async function PublicManagedPage({ params, searchParams }: PublicManagedPageProps) {
  const lang = searchParams?.lang;
  const page = await publicPagesService.getBySlug(params.slug, lang);
  if (!page) notFound();

  const brand = await getPlatformBrand();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-primary hover:text-primary-dark">
          Back to {brand.name} AI
        </Link>
        <article className="mt-8 border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
          <div className="crm-rich-content mt-8" dangerouslySetInnerHTML={{ __html: page.content }} />
        </article>
      </div>
    </main>
  );
}
