import { buildQueryString } from "@/lib/utils";
import { api } from "@/utils/API";
import type { ApiResponse, QueryParams } from "@/types";
import type { User, CreateUserPayload, UpdateUserPayload } from "@/types/user.types";

interface BackendUserResponse {
  id: number;
  full_name: string;
  email: string;
  mobile: string | null;
  role_id: number;
  tenant_id: number | null;
  is_active: boolean;
  email_verified: boolean;
  createdAt: string;
  updatedAt: string;
  id_proof?: string[];
  address_proof?: string[];
  clinic_name?: string | null;
  profile_photo?: string | null;
  Role?: {
    id: number;
    name: "super_admin" | "tenant_admin" | "staff_user";
  };
  Tenant?: {
    id: number;
    full_name: string;
    email: string;
  };
}

const mapBackendUser = (user: BackendUserResponse): User => ({
  id: String(user.id),
  name: user.full_name,
  full_name: user.full_name,
  email: user.email,
  mobile: user.mobile,
  role: user.Role?.name ?? "staff_user",
  role_id: user.role_id,
  isActive: user.is_active,
  is_active: user.is_active,
  tenantId: user.tenant_id != null ? String(user.tenant_id) : undefined,
  tenantName: user.Tenant?.full_name,
  tenant_id: user.tenant_id,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  id_proof: user.id_proof ?? [],
  address_proof: user.address_proof ?? [],
  clinic_name: user.clinic_name ?? null,
  profile_photo: user.profile_photo ?? null,
});

const buildUserFormData = (payload: CreateUserPayload | UpdateUserPayload): FormData => {
  const fd = new FormData();
  const { id_proof, address_proof, profile_photo, ...rest } = payload as Record<string, unknown>;

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== null) {
      fd.append(key, String(value));
    }
  }

  if (Array.isArray(id_proof)) {
    (id_proof as File[]).forEach((f) => fd.append("id_proof", f));
  }
  if (Array.isArray(address_proof)) {
    (address_proof as File[]).forEach((f) => fd.append("address_proof", f));
  }
  if (profile_photo instanceof File) {
    fd.append("profile_photo", profile_photo);
  }

  return fd;
};

const hasFiles = (payload: CreateUserPayload | UpdateUserPayload): boolean =>
  !!(payload.id_proof?.length || payload.address_proof?.length || payload.profile_photo);

export const userService = {
  async getTenantAdmins(): Promise<ApiResponse<User[]>> {
    const { data } = await api.get<ApiResponse<BackendUserResponse[]>>("/users/tenant-admins");
    return { ...data, data: (data.data ?? []).map(mapBackendUser) };
  },

  async getAll(params?: QueryParams): Promise<ApiResponse<User[]>> {
    const query = params ? `?${buildQueryString(params)}` : "";
    const { data } = await api.get<ApiResponse<BackendUserResponse[]>>(`/users${query}`);
    return { ...data, data: (data.data ?? []).map(mapBackendUser) };
  },

  async getById(id: string): Promise<ApiResponse<User>> {
    const { data } = await api.get<ApiResponse<BackendUserResponse>>(`/users/${id}`);
    return { ...data, data: mapBackendUser(data.data) };
  },

  async create(payload: CreateUserPayload): Promise<ApiResponse<User>> {
    if (hasFiles(payload)) {
      const { data } = await api.post<ApiResponse<BackendUserResponse>>("/users", buildUserFormData(payload), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return { ...data, data: mapBackendUser(data.data) };
    }
    const { data } = await api.post<ApiResponse<BackendUserResponse>>("/users", payload);
    return { ...data, data: mapBackendUser(data.data) };
  },

  async update(id: string, payload: UpdateUserPayload): Promise<ApiResponse<User>> {
    if (hasFiles(payload)) {
      const { data } = await api.put<ApiResponse<BackendUserResponse>>(`/users/${id}`, buildUserFormData(payload), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return { ...data, data: mapBackendUser(data.data) };
    }
    const { data } = await api.put<ApiResponse<BackendUserResponse>>(`/users/${id}`, payload);
    return { ...data, data: mapBackendUser(data.data) };
  },

  async delete(id: string): Promise<ApiResponse> {
    const { data } = await api.delete<ApiResponse>(`/users/${id}`);
    return data;
  },

  async deleteDocument(
    userId: string,
    type: "id_proof" | "address_proof",
    filename: string
  ): Promise<ApiResponse<User>> {
    const { data } = await api.delete<ApiResponse<BackendUserResponse>>(`/users/${userId}/document`, {
      data: { type, filename },
    });
    return { ...data, data: mapBackendUser(data.data) };
  },
};
