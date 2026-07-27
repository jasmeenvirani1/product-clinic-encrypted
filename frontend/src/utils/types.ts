import type { ReactNode } from "react";

export type Role = "super_admin" | "tenant_admin" | "staff_user";
export type SenderType = "user" | "ai" | "human";
export type ThemeMode = "light" | "dark";

// Ã¢â‚¬Â¦ existing unchanged content above omitted for brevity in generation context
// NOTE: this file is rewritten from current content with only PlanRecord shape adjusted.

export interface MenuPermission {
  menu: {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
    parent_id: number | null;
    sort_order: number;
  };
  permissions: string[];
}

export interface BackendRole {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendMenu {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface BackendPermission {
  id: number;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId?: string;
  avatar?: string;
  mobile?: string | null;
  clinic_name?: string | null;
  isOnTrial?: boolean;
  trialEndsAt?: string | null;
  trialDaysLeft?: number | null;
  isPlanExpired?: boolean;
  featureFlags?: PlanFeatureFlags; // resolved effective flags from GET /auth/me
}

export interface Tenant {
  id: string;
  name: string;
  city: string;
  plan: string;
  status: "active" | "inactive" | "trial";
  activeUsers: number;
  monthlyRevenue: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage: "new" | "qualified" | "discussion" | "won" | "lost";
  city: string | null;
  score: number;
  notes: string | null;
  remark: string | null;
  last_message: string | null;
  assigned_to: number | null;
  created_by: number | null;
  tenant_id: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  ai_summary: string | null;
  summary_updated_at: string | null;
  custom_data?: Record<string, unknown> | null;
  AssignedUser?: { id: number; full_name: string; email: string } | null;
  CreatedByUser?: { id: number; full_name: string } | null;
  clinic?: string;
  assignedTo?: string;
  lastMessage?: string;
}

export interface MessageAttachment {
  url: string;
  mime_type: string;
  file_name: string;
  size?: number;
  kind: "image" | "video" | "audio" | "file";
}

export interface Message {
  id: string;
  conversationId: string;
  sender: SenderType;
  text: string;
  timestamp: string;
  senderName?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  leadScore?: number | null;
  lastMessage?: string | null;
  channel: "WhatsApp" | "Instagram" | "Web Chat";
  assignedTo: string;
  status: "open" | "pending" | "resolved";
  unreadCount: number;
  aiEnabled: boolean;
  lastMessageAt: string;
  intent?: "high" | "medium" | "low" | "unknown";
  tenantId?: number | null;
  custom_data?: Record<string, unknown> | null;
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
}

export interface SuperAdminDashboardData {
  metrics: DashboardMetric[];
  tenants: Tenant[];
  recentPayments: PaymentRecord[];
  recentTickets: { id: number; subject: string; status: string; createdBy: string; date: string; createdDate?: string; updatedDate?: string }[];
}

export interface TenantDashboardMetric extends DashboardMetric {
  _dynamic?: boolean;
  _static?: boolean;
}

export interface TenantDashboardData {
  tenantName?: string;
  metrics: TenantDashboardMetric[];
  funnel: Array<{ label: string; value: number }>;
  recentLeads: Array<{ id: string | number; name: string; source: string; stage: string; date: string }>;
  recentTickets: Array<{ id: string | number; subject: string; status: string; date: string; createdDate?: string; updatedDate?: string }>;
  teamCount?: number;
}

export interface PaymentRecord {
  id: string;
  tenantName: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  date: string;
  method: string;
  userName?: string;
  userEmail?: string;
  role?: string;
  planName?: string;
  period?: "monthly" | "yearly" | null;
  currency?: string;
  transactionId?: string;
}

export interface SubscriptionRecord {
  id: string;
  tenantName: string;
  planName: string;
  seats: number;
  renewalDate: string;
  status: "active" | "trial" | "past_due";
  userName?: string;
  userEmail?: string;
  role?: string;
  period?: "monthly" | "yearly" | null;
  purchaseDate?: string;
  planExpiresAt?: string;
  latestPaymentStatus?: string;
}

export interface PlanFeatureFlags {
  whatsapp_multi_connection?: boolean;
  dedicated_clinic_page?: "none" | "video_upload_only" | "full_access";
  chapter_instagram_integration?: boolean;
  instagram_realtime_fetch?: boolean;
  chapter_creation?: boolean;
  video_like?: boolean;
  automatic_website_generation?: boolean;
  specialities?: boolean;
}

export interface PlanRecord {
  id: string | number;
  name: string;
  price: number;
  monthly_price?: number;
  yearly_price?: number;
  period?: "monthly" | "yearly";
  features: string[];
  feature_flags?: PlanFeatureFlags;
}

export interface SupportTicket {
  id: number;
  subject: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  attachment: string | null;
  created_by: number;
  tenant_id: number;
  is_active: boolean;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
  CreatedByUser?: { id: number; full_name: string; email: string } | null;
}

export interface SystemLog {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  module: string;
  action: string;
  [key: string]: unknown;
}

export interface IntegrationKey {
  id: string;
  provider: string;
  keyPreview: string;
  status: "connected" | "disconnected";
  scope: "global" | "tenant";
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  budget: string;
  status: "draft" | "active" | "paused";
  custom_data?: Record<string, unknown> | null;
}

export interface BillingSummary {
  currentPlan: string;
  renewalDate: string;
  monthlySpend: string;
  history: PaymentRecord[];
  allPlans?: PlanRecord[];
  purchasedPlan?: PlanRecord | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "tenant_admin" | "staff_user";
  status: "active" | "invited";
}

export interface VideoRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail: string | null;
  status: "active" | "inactive";
  uploaded_by: number;
  menu_id?: number | null;
  show_on_landing?: boolean;
  is_active: boolean;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
  created_at?: string;
  UploadedByUser?: { id: number; full_name: string; email: string } | null;
  Menu?: { id: number; name: string; slug: string } | null;
}

export interface MenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  roles: Role[];
}

