export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export type SortOrder = "asc" | "desc";

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}
