export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "moderator";
  avatar?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
