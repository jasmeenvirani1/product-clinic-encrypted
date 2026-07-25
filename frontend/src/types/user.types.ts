export interface User {
  id: string;
  name: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  role: "super_admin" | "tenant_admin" | "staff_user";
  role_id?: number;
  avatar?: string;
  isActive: boolean;
  is_active: boolean;
  tenantId?: string;
  tenantName?: string;
  tenant_id?: number | null;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  id_proof?: string[];
  address_proof?: string[];
  clinic_name?: string | null;
  profile_photo?: string | null;
}

export interface CreateUserPayload {
  full_name: string;
  email: string;
  password: string;
  role_id: number;
  mobile?: string;
  tenant_id?: number | null;
  clinic_name?: string;
  id_proof?: File[];
  address_proof?: File[];
  profile_photo?: File;
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  role_id?: number;
  is_active?: boolean;
  mobile?: string;
  password?: string;
  tenant_id?: number | null;
  clinic_name?: string;
  id_proof?: File[];
  address_proof?: File[];
  profile_photo?: File;
  remove_profile_photo?: boolean;
}
