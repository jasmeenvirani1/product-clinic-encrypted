import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authRoutes       = ["/login", "/register", "/forgot-password", "/verify-otp"];
const appRoutes        = ["/app", "/upload-documents", "/onboarding"];
const superAdminRoutes = ["/super-admin"];

// ─── JWT helpers (Edge-runtime safe, no crypto) ──────────────────────
interface JwtPayload {
  id:      number;
  role_id: number;
  role?:   string;
  exp?:    number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json   = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (!payload.exp) return true; // no expiry set — treat as valid
  return Date.now() / 1000 < payload.exp;
}

function getRedirectHome(token: string): string {
  const payload = decodeJwtPayload(token);
  const isSuperAdmin = payload?.role === "super_admin" || payload?.role_id === 1;
  return isSuperAdmin ? "/super-admin/dashboard" : "/app/dashboard";
}

// ─── Middleware ──────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieToken  = request.cookies.get("crm_auth_session")?.value;

  // A session is only "authenticated" if the cookie holds a non-expired JWT
  const isAuthenticated = Boolean(cookieToken && isTokenValid(cookieToken));

  const isAuthRoute      = authRoutes.some((p)      => pathname.startsWith(p));
  const isAppRoute       = appRoutes.some((p)       => pathname.startsWith(p));
  const isSuperAdminRoute = superAdminRoutes.some((p) => pathname.startsWith(p));

  // Protected route but no valid session → send to login, clear stale cookie
  if ((isAppRoute || isSuperAdminRoute) && !isAuthenticated) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("crm_auth_session");
    return res;
  }

  // Auth route but already logged in → redirect to their dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL(getRedirectHome(cookieToken!), request.url));
  }

  // Super admin on /app/* → redirect to super-admin dashboard (prevents layout flash)
  if (isAppRoute && isAuthenticated) {
    const payload = decodeJwtPayload(cookieToken!);
    const isSuperAdmin = payload?.role === "super_admin" || payload?.role_id === 1;
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL("/super-admin/dashboard", request.url));
    }
  }

  // Non-super-admin on /super-admin/* → redirect to app dashboard
  if (isSuperAdminRoute && isAuthenticated) {
    const payload = decodeJwtPayload(cookieToken!);
    const isSuperAdmin = payload?.role === "super_admin" || payload?.role_id === 1;
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/app/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
