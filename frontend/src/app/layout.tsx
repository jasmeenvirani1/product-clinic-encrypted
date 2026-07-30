import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { ReduxProvider } from "@/providers/ReduxProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AntdProvider } from "@/providers/AntdProvider";
import { APP_TAGLINE } from "@/constants/brand";
import { THEME_PRELOAD_SCRIPT } from "@/utils/themePreload";
import { getPlatformBrand } from "@/lib/getPlatformBrand";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface SeoSettingRow {
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
}

export async function generateMetadata(): Promise<Metadata> {
  let seo: SeoSettingRow | null = null;

  try {
    const res = await fetch(`${API_BASE}/public/seo-settings/landing`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      seo = json?.data ?? null;
    }
  } catch {
    // Network error, timeout, or DB down — fail open to static defaults below.
    seo = null;
  }

  const brand = await getPlatformBrand();
  const title = seo?.meta_title || brand.fullName;
  const description = seo?.meta_description || APP_TAGLINE;

  const hasOg = !!(seo?.og_title || seo?.og_description || seo?.og_image);

  return {
    title,
    description,
    ...(hasOg
      ? {
          openGraph: {
            title: seo?.og_title || title,
            description: seo?.og_description || description,
            images: seo?.og_image ? [seo.og_image] : undefined,
          },
        }
      : {}),
    ...(seo?.canonical_url
      ? {
          alternates: {
            canonical: seo.canonical_url,
          },
        }
      : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${dmSans.variable}`}>
      <head>
        {/* Applies the cached theme synchronously before first paint to prevent
            the default theme flashing while ThemeProvider fetches the real one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRELOAD_SCRIPT }} />
      </head>
      <body className="font-body">
        <ReduxProvider>
          <ThemeProvider>
            <AntdProvider>{children}</AntdProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
