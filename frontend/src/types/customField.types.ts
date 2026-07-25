export interface CustomField {
  id: number;
  table_name: "leads" | "conversations" | "campaigns";
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateCustomFieldPayload = Omit<CustomField, "id" | "createdAt" | "updatedAt">;
export type UpdateCustomFieldPayload = Partial<Omit<CustomField, "id" | "table_name" | "field_key" | "createdAt" | "updatedAt">>;
