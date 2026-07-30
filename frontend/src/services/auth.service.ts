import { api } from "../utils/API";
import type { MenuPermission, PlanFeatureFlags, Role, User } from "../utils/types";

const ROLE_HOME: Record<string, string> = {
  super_admin:  "/super-admin/dashboard",
  tenant_admin: "/app/dashboard",
  staff_user:   "/app/dashboard",
};

const ROLE_ID_HOME: Record<number, string> = {
  1: "/super-admin/dashboard",
  2: "/app/dashboard",
  3: "/app/dashboard",
  4: "/app/dashboard",
};

// role_id → role string (matches backend seeded roles)
const ROLE_ID_MAP: Record<number, Role> = {
  1: "super_admin",
  2: "tenant_admin",
  3: "staff_user",
  4: "tenant_admin",
};

// Shape returned by /api/auth/login and /api/auth/me
interface BackendUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  role_id?: number;
  mobile?: string | null;
  clinic_name?: string | null;
  profile_photo?: string | null;
  logo_url?: string | null;
}

// Decode JWT payload without crypto (edge-safe)
function decodeJwtRole(token: string): Role | null {
  try {
    const [, p] = token.split(".");
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as {
      role_id?: number;
      role?: string;
    };
    if (json.role && json.role !== "undefined") return json.role as Role;
    if (json.role_id) return ROLE_ID_MAP[json.role_id] ?? null;
  } catch {
    // ignore
  }
  return null;
}

function toFrontendUser(bu: BackendUser, token?: string): User {
  let role = bu.role as Role;

  // Backend sometimes omits the role string on the user object (e.g. verify-otp).
  // Fall back to JWT role_id or BackendUser.role_id so the stored user is always valid.
  const isInvalidRole = !role || (role as string) === "undefined" || (role as string) === "null";
  if (isInvalidRole) {
    if (token) role = decodeJwtRole(token) ?? role;
    if (isInvalidRole && bu.role_id) role = ROLE_ID_MAP[bu.role_id] ?? "tenant_admin";
    if (!role || (role as string) === "undefined") role = "tenant_admin";
  }

  return {
    id:         String(bu.id),
    name:       bu.full_name,
    email:      bu.email,
    role,
    mobile:     bu.mobile ?? null,
    clinic_name: bu.clinic_name ?? null,
    avatar: bu.profile_photo ?? undefined,
    logo_url: bu.logo_url ?? null,
  };
}

function getRedirectFromToken(token: string, fallbackRole?: string): string {
  try {
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) return ROLE_HOME[fallbackRole ?? ""] ?? "/app/dashboard";
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized)) as { role_id?: number };
    if (json.role_id && ROLE_ID_HOME[json.role_id]) return ROLE_ID_HOME[json.role_id];
  } catch {
    // ignore and fallback
  }
  return ROLE_HOME[fallbackRole ?? ""] ?? "/app/dashboard";
}

export const authService = {
  async login(input: {
    email: string;
    password: string;
    role?: Role;
  }): Promise<{ user: User; token: string; redirectTo: string; menuPermissions: MenuPermission[] }> {
    const { data } = await api.post("/auth/login", {
      email:    input.email,
      password: input.password,
    });

    const { token, user: bu, menuPermissions, redirectTo: serverRedirectTo } = data.data as {
      token: string;
      user: BackendUser;
      menuPermissions: MenuPermission[];
      redirectTo?: string;
    };

    const user = toFrontendUser(bu, token);

    return {
      user,
      token,
      redirectTo:      serverRedirectTo ?? getRedirectFromToken(token, user.role),
      menuPermissions: menuPermissions ?? [],
    };
  },

  async getMe(): Promise<{ user: User; menuPermissions: MenuPermission[] }> {
    const { data } = await api.get("/auth/me");
    const { user: bu, menuPermissions, planContext } = data.data as {
      user: BackendUser;
      menuPermissions: MenuPermission[];
      planContext?: {
        is_on_trial?: boolean;
        trial_ends_at?: string | null;
        trial_days_left?: number | null;
        is_expired?: boolean;
        feature_flags?: PlanFeatureFlags;
      };
    };
    const user = toFrontendUser(bu);
    user.isOnTrial     = planContext?.is_on_trial    ?? false;
    user.trialEndsAt   = planContext?.trial_ends_at  ?? null;
    user.trialDaysLeft = planContext?.trial_days_left ?? null;
    user.isPlanExpired = planContext?.is_expired      ?? false;
    user.featureFlags  = planContext?.feature_flags  ?? {};
    return { user, menuPermissions: menuPermissions ?? [] };
  },

  async updateProfile(payload: {
    full_name?: string;
    mobile?: string;
    clinic_name?: string;
    old_password?: string;
    new_password?: string;
    profile_photo?: File;
    remove_profile_photo?: boolean;
  }): Promise<{ id: string; full_name: string; email: string; mobile: string | null; clinic_name: string | null; profile_photo?: string | null }> {
    const shouldMultipart = !!(payload.profile_photo || payload.remove_profile_photo);
    const requestBody = shouldMultipart
      ? (() => {
          const fd = new FormData();
          if (payload.full_name !== undefined) fd.append("full_name", payload.full_name);
          if (payload.mobile !== undefined) fd.append("mobile", payload.mobile);
          if (payload.clinic_name !== undefined) fd.append("clinic_name", payload.clinic_name);
          if (payload.old_password !== undefined) fd.append("old_password", payload.old_password);
          if (payload.new_password !== undefined) fd.append("new_password", payload.new_password);
          if (payload.remove_profile_photo) fd.append("remove_profile_photo", "true");
          if (payload.profile_photo) fd.append("profile_photo", payload.profile_photo);
          return fd;
        })()
      : payload;

    const { data } = await api.put("/auth/profile", requestBody, shouldMultipart
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined);
    return data.data;
  },

  async logout() {
    return { success: true };
  },

  async register(payload: { clinicName: string; name: string; email: string; password: string; mobile?: string; profile_photo?: File }) {
    const { data } = await api.post("/auth/register/send-otp", {
      full_name: payload.name,
      email: payload.email,
      mobile: payload.mobile ?? null,
      password: payload.password,
    });

    return { success: data.success ?? true, email: payload.email };
  },

  async requestOtp(email: string) {
    return { success: true, email };
  },

  async sendForgotPasswordOtp(email: string): Promise<{ success: boolean; email: string }> {
    await api.post("/auth/forgot-password/send-otp", { email });
    return { success: true, email };
  },

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const { data } = await api.post("/auth/forgot-password/verify-otp", { email, otp });
    const resetToken = data.data?.resetToken;
    if (!resetToken) throw new Error("No reset token returned.");
    return { resetToken };
  },

  async resetPasswordWithOtp(resetToken: string, newPassword: string): Promise<void> {
    await api.post("/auth/forgot-password/reset", { resetToken, new_password: newPassword });
  },

  async verifyOtp(payload: {
    name: string;
    email: string;
    password: string;
    mobile?: string;
    clinicName?: string;
    otp: string;
    profile_photo?: File;
  }) {
    const body = {
      full_name: payload.name,
      email: payload.email,
      mobile: payload.mobile ?? null,
      clinic_name: payload.clinicName ?? null,
      password: payload.password,
      otp: payload.otp,
    };
    const requestBody = payload.profile_photo
      ? (() => {
          const fd = new FormData();
          fd.append("full_name", body.full_name);
          fd.append("email", body.email);
          fd.append("mobile", body.mobile ?? "");
          fd.append("clinic_name", body.clinic_name ?? "");
          fd.append("password", body.password);
          fd.append("otp", body.otp);
          fd.append("profile_photo", payload.profile_photo);
          return fd;
        })()
      : body;

    const { data } = await api.post("/auth/register/verify-otp", requestBody, payload.profile_photo
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined);

    const { token, user: bu } = data.data as {
      token: string;
      user: BackendUser;
    };

    const user = toFrontendUser(bu, token);
    return {
      user,
      token,
      redirectTo: getRedirectFromToken(token, user.role),
      menuPermissions: [] as MenuPermission[],
    };
  },

  // Brand setup (post-OTP): upload the clinic logo and get an AI-suggested
  // primary theme colour. Requires the user to be authenticated (token set
  // after verifyOtp). Does NOT apply the theme — the caller decides.
  async brandSetupUploadLogo(logo: File): Promise<{
    logo: string;
    logo_url: string | null;
    suggestedColors: Record<string, string>;
    suggestedPrimary: string;
    source: "ai" | "fallback";
    fallbackPrimary: string;
  }> {
    const fd = new FormData();
    fd.append("logo", logo);
    const { data } = await api.post("/auth/register/brand-setup", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },
};
