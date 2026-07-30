// Server-side helper for Next.js Server Components, which cannot use the
// client-only ThemeProvider context. Mirrors the existing inline SEO fetch in
// app/layout.tsx's generateMetadata() — a per-request fetch of the public
// theme/brand endpoint with a fail-open fallback to the static brand.ts
// defaults. There is no client-side caching concern here: Next.js server-
// renders fresh HTML per request (cache: "no-store"), same as the SEO fetch.
import { APP_NAME, APP_SHORT_NAME, APP_FULL_NAME } from "@/constants/brand";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface PlatformBrand {
  name: string;
  shortName: string;
  fullName: string;
}

export async function getPlatformBrand(): Promise<PlatformBrand> {
  try {
    const res = await fetch(`${API_BASE}/public/theme`, { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    const json = await res.json();
    const d = json?.data;
    return {
      name: d?.platformName || APP_NAME,
      shortName: d?.platformShortName || APP_SHORT_NAME,
      fullName: d?.platformFullName || APP_FULL_NAME,
    };
  } catch {
    // Fail-open to the static defaults — same fallback philosophy as the
    // existing SEO fetch in app/layout.tsx.
    return { name: APP_NAME, shortName: APP_SHORT_NAME, fullName: APP_FULL_NAME };
  }
}
