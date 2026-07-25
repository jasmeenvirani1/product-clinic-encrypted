import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { authService } from "../../services/auth.service";
import type { MenuPermission, Role, User } from "../../utils/types";
import type { RootState } from "../index";
import { resetThemeVars } from "../../utils/themeVars";

const AUTH_STORAGE_KEY = "crm_auth_session";

interface AuthState {
  user:               User | null;
  token:              string | null;
  menuPermissions:    MenuPermission[];
  permissionsLoading: boolean;
  redirectTo:         string | null;
  status:             "idle" | "loading" | "authenticated" | "error";
  error:              string | null;
  otpEmail:           string | null;
  resetToken:         string | null;
  registrationDraft:  { clinicName: string; name: string; email: string; password: string; mobile?: string; profile_photo?: File } | null;
}

// ─── Persistence helpers ────────────────────────────────────────────
interface PersistedAuth {
  user:  User;
  token: string;
}

const loadPersistedAuth = (): Pick<AuthState, "user" | "token"> => {
  if (typeof window === "undefined") return { user: null, token: null };
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw) as PersistedAuth;
    return {
      user:  parsed.user  ?? null,
      token: parsed.token ?? null,
    };
  } catch {
    return { user: null, token: null };
  }
};

const persistAuth = (payload: { user: User | null; token: string | null }) => {
  if (typeof window === "undefined") return;
  if (!payload.user || !payload.token) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // Drop the cached tenant theme AND reset the applied CSS vars immediately so
    // the previous tenant's colours don't linger/flash before the next paint.
    localStorage.removeItem("crm_theme_v2");
    resetThemeVars();
    document.cookie = "crm_auth_session=; path=/; max-age=0";
    return;
  }
  // Only persist user identity and token — menuPermissions are always fetched fresh
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: payload.user, token: payload.token }));
  document.cookie = `crm_auth_session=${payload.token}; path=/; max-age=86400`;
};

// ─── Thunks ─────────────────────────────────────────────────────────
export const loginThunk = createAsyncThunk(
  "auth/login",
  async (payload: { email: string; password: string; role?: Role }, { rejectWithValue }) => {
    try {
      return await authService.login(payload);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      return rejectWithValue(msg ?? "Invalid email or password.");
    }
  }
);

export const fetchMeThunk = createAsyncThunk("auth/fetchMe", async () =>
  authService.getMe()
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (
    payload: { clinicName: string; name: string; email: string; password: string; mobile?: string; profile_photo?: File },
    { rejectWithValue }
  ) => {
    try {
      return await authService.register(payload);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      return rejectWithValue(msg ?? "Registration failed.");
    }
  }
);

export const requestOtpThunk = createAsyncThunk("auth/requestOtp", async (email: string) =>
  authService.requestOtp(email)
);

export const sendForgotOtpThunk = createAsyncThunk(
  "auth/sendForgotOtp",
  async (email: string, { rejectWithValue }) => {
    try {
      return await authService.sendForgotPasswordOtp(email);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      return rejectWithValue(msg ?? "Failed to send OTP.");
    }
  }
);

export const verifyForgotOtpThunk = createAsyncThunk(
  "auth/verifyForgotOtp",
  async ({ email, otp }: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      return await authService.verifyForgotPasswordOtp(email, otp);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      return rejectWithValue(msg ?? "Invalid or expired OTP.");
    }
  }
);

export const resetPasswordThunk = createAsyncThunk(
  "auth/resetPassword",
  async ({ resetToken, newPassword }: { resetToken: string; newPassword: string }, { rejectWithValue }) => {
    try {
      await authService.resetPasswordWithOtp(resetToken, newPassword);
      return { success: true };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      return rejectWithValue(msg ?? "Failed to reset password.");
    }
  }
);

export const verifyOtpThunk = createAsyncThunk(
  "auth/verifyOtp",
  async (
    payload: { otp: string },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as RootState;
    const draft = state.auth.registrationDraft;
    if (!draft) return rejectWithValue("Registration details are missing. Please register again.");
    return authService.verifyOtp({
      name: draft.name,
      email: draft.email,
      password: draft.password,
      mobile: draft.mobile,
      otp: payload.otp,
      profile_photo: draft.profile_photo,
    });
  }
);

// ─── Initial state ───────────────────────────────────────────────────
const persisted = loadPersistedAuth();

const initialState: AuthState = {
  user:               persisted.user,
  token:              persisted.token,
  menuPermissions:    [],  // Never use stale localStorage permissions; always fetch fresh via fetchMeThunk
  permissionsLoading: !!(persisted.user && persisted.token && persisted.user.role !== "super_admin"),
  redirectTo:         null, // Middleware redirects authenticated users away from /login; only loginThunk sets this
  status:             persisted.user ? "authenticated" : "idle",
  error:              null,
  otpEmail:           null,
  resetToken:         null,
  registrationDraft:  null,
};

// ─── Slice ──────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user            = null;
      state.token           = null;
      state.menuPermissions = [];
      state.redirectTo      = null;
      state.status          = "idle";
      state.registrationDraft = null;
      persistAuth({ user: null, token: null });
    },
    clearRedirect(state) {
      state.redirectTo = null;
    },
    setRolePreview(state, action: PayloadAction<Role>) {
      if (state.user) state.user.role = action.payload;
    },
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      if (action.payload) state.status = "authenticated";
    },
    setPlanExpired(state) {
      if (state.user) state.user.isPlanExpired = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── login ──
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error  = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status              = "authenticated";
        state.user                = action.payload.user;
        state.token               = action.payload.token;
        state.menuPermissions     = action.payload.menuPermissions;
        state.permissionsLoading  = false;
        state.redirectTo          = action.payload.redirectTo;
        persistAuth({ user: action.payload.user, token: action.payload.token });
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "error";
        state.error  = (action.payload as string) ?? "Invalid email or password.";
      })
      // ── fetchMe ──
      .addCase(fetchMeThunk.pending, (state) => {
        // Only show the loading state when we have NO permissions yet.
        // Background re-fetches must not flash the skeleton over a sidebar
        // that's already rendered from the login response.
        if (state.menuPermissions.length === 0) {
          state.permissionsLoading = true;
        }
      })
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.user               = action.payload.user;
        state.menuPermissions    = action.payload.menuPermissions;
        state.permissionsLoading = false;
        state.status             = "authenticated";
        persistAuth({ user: action.payload.user, token: state.token });
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        // Token is invalid or expired — force a full logout so the cookie is cleared
        // and the user is sent back to the login page
        state.user               = null;
        state.token              = null;
        state.menuPermissions    = [];
        state.permissionsLoading = false;
        state.status             = "idle";
        state.redirectTo         = "/login";
        persistAuth({ user: null, token: null });
      })
      // ── register / otp ──
      .addCase(registerThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.status   = "idle";
        state.error    = null;
        state.otpEmail = action.payload.email;
        state.registrationDraft = action.meta.arg;
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = (action.payload as string) ?? "Registration failed.";
      })
      .addCase(requestOtpThunk.pending,   (state) => { state.status = "loading"; })
      .addCase(requestOtpThunk.fulfilled, (state, action) => {
        state.status   = "idle";
        state.otpEmail = action.payload.email;
      })
      // ── forgot password OTP ──
      .addCase(sendForgotOtpThunk.pending,   (state) => { state.status = "loading"; state.error = null; })
      .addCase(sendForgotOtpThunk.fulfilled, (state, action) => {
        state.status   = "idle";
        state.otpEmail = action.payload.email;
      })
      .addCase(sendForgotOtpThunk.rejected,  (state, action) => {
        state.status = "error";
        state.error  = (action.payload as string) ?? "Failed to send OTP.";
      })
      .addCase(verifyForgotOtpThunk.pending,   (state) => { state.status = "loading"; state.error = null; })
      .addCase(verifyForgotOtpThunk.fulfilled, (state, action) => {
        state.status     = "idle";
        state.resetToken = action.payload.resetToken;
      })
      .addCase(verifyForgotOtpThunk.rejected,  (state, action) => {
        state.status = "error";
        state.error  = (action.payload as string) ?? "Invalid or expired OTP.";
      })
      .addCase(resetPasswordThunk.pending,   (state) => { state.status = "loading"; state.error = null; })
      .addCase(resetPasswordThunk.fulfilled, (state) => {
        state.status     = "idle";
        state.resetToken = null;
        state.otpEmail   = null;
      })
      .addCase(resetPasswordThunk.rejected,  (state, action) => {
        state.status = "error";
        state.error  = (action.payload as string) ?? "Failed to reset password.";
      })
      .addCase(verifyOtpThunk.pending, (state) => { state.status = "loading"; })
      .addCase(verifyOtpThunk.fulfilled, (state, action) => {
        state.status              = "authenticated";
        state.user                = action.payload.user;
        state.token               = action.payload.token;
        state.menuPermissions     = action.payload.menuPermissions;
        state.permissionsLoading  = false;
        state.redirectTo          = action.payload.redirectTo;
        state.registrationDraft   = null;
        persistAuth({ user: action.payload.user, token: action.payload.token });
      })
      .addCase(verifyOtpThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = (action.payload as string) ?? "OTP verification failed.";
      });
  },
});

export const { logout, clearRedirect, setRolePreview, setUser, setPlanExpired } = authSlice.actions;
export default authSlice.reducer;
