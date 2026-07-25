import { api } from "../utils/API";
import type { BackendMenu, BackendPermission, BackendRole } from "../utils/types";

// ─── Role service ────────────────────────────────────────────────────

export interface RolePermissionAssignment {
  menu_id:        number;
  permission_ids: number[];
}

export interface RoleWithPermissions {
  role:            BackendRole;
  menuPermissions: Array<{
    Menu:       BackendMenu;
    Permission: BackendPermission;
  }>;
}

export const roleService = {
  async getAll(): Promise<BackendRole[]> {
    const { data } = await api.get("/roles");
    return data.data;
  },

  async getById(id: number): Promise<RoleWithPermissions> {
    const { data } = await api.get(`/roles/${id}`);
    return data.data;
  },

  async create(payload: { name: string; description?: string }): Promise<BackendRole> {
    const { data } = await api.post("/roles", payload);
    return data.data;
  },

  async update(
    id: number,
    payload: { name?: string; description?: string; is_active?: boolean }
  ): Promise<BackendRole> {
    const { data } = await api.put(`/roles/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/roles/${id}`);
  },

  async assignPermissions(
    roleId: number,
    permissions: RolePermissionAssignment[]
  ): Promise<void> {
    await api.post(`/roles/${roleId}/permissions`, { permissions });
  },
};

// ─── Menu service ────────────────────────────────────────────────────

export const menuService = {
  async getAll(): Promise<BackendMenu[]> {
    const { data } = await api.get("/menus/flat");
    return data.data;
  },

  async create(payload: {
    name:       string;
    slug:       string;
    icon?:      string;
    parent_id?: number | null;
    sort_order?: number;
  }): Promise<BackendMenu> {
    const { data } = await api.post("/menus", payload);
    return data.data;
  },

  async update(
    id: number,
    payload: Partial<{ name: string; slug: string; icon: string; parent_id: number | null; sort_order: number; is_active: boolean }>
  ): Promise<BackendMenu> {
    const { data } = await api.put(`/menus/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/menus/${id}`);
  },
};

// ─── Permission service ──────────────────────────────────────────────

export const permissionService = {
  async getAll(): Promise<BackendPermission[]> {
    const { data } = await api.get("/permissions");
    return data.data;
  },
};

// ─── Log service ─────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level:     "INFO" | "WARN" | "ERROR";
  module:    string;
  action:    string;
  [key: string]: unknown;
}

export interface LogsResponse {
  data:  LogEntry[];
  total: number;
  page:  number;
  limit: number;
}

export interface LogFilters {
  date?:   string;
  level?:  string;
  module?: string;
  action?: string;
  page?:   number;
  limit?:  number;
}

export const logService = {
  async getLogs(filters: LogFilters = {}): Promise<LogsResponse> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
    );
    const { data } = await api.get("/logs", { params });
    return data;
  },

  async getLogDates(): Promise<string[]> {
    const { data } = await api.get("/logs/dates");
    return data.data;
  },
};

// ─── User service (super-admin only) ────────────────────────────────

export interface BackendUser {
  id:             number;
  full_name:      string;
  email:          string;
  mobile:         string | null;
  is_active:      boolean;
  email_verified: boolean;
  role_id:        number;
  Role:           BackendRole;
  createdAt:      string;
}

export const userService = {
  async getAll(): Promise<BackendUser[]> {
    const { data } = await api.get("/users");
    return data.data;
  },

  async create(payload: {
    full_name: string;
    email:     string;
    password:  string;
    role_id:   number;
    mobile?:   string;
  }): Promise<BackendUser> {
    const { data } = await api.post("/users", payload);
    return data.data;
  },

  async update(
    id: number,
    payload: Partial<{ full_name: string; mobile: string; role_id: number; is_active: boolean; password: string }>
  ): Promise<BackendUser> {
    const { data } = await api.put(`/users/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
