import type {
  BillingSummary,
  Campaign,
  Conversation,
  IntegrationKey,
  Message,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
  SuperAdminDashboardData,
  TeamMember,
  Tenant,
  TenantDashboardData,
  User,
} from "../utils/types";

export const mockUsers: User[] = [
  { id: "u1", name: "Sarah Malik", email: "owner@novaclinic.ai", role: "tenant_admin", tenantId: "t1" },
  { id: "u2", name: "Arjun Patel", email: "staff@novaclinic.ai", role: "staff_user", tenantId: "t1" },
  { id: "u3", name: "Platform Admin", email: "super@medleads.ai", role: "super_admin" },
];

export const mockTenants: Tenant[] = [
  { id: "t1", name: "Nova Hair Clinic", city: "Istanbul", plan: "Growth AI", status: "active", activeUsers: 12, monthlyRevenue: 2499 },
  { id: "t2", name: "Apex Smile Center", city: "Dubai", plan: "Scale", status: "trial", activeUsers: 7, monthlyRevenue: 1499 },
  { id: "t3", name: "Luma Skin Studio", city: "London", plan: "Starter", status: "inactive", activeUsers: 4, monthlyRevenue: 699 },
];


export const mockConversations: Conversation[] = [
  { id: "c1", leadId: "l1", leadName: "Mila Hart", channel: "WhatsApp", assignedTo: "Arjun Patel", status: "open", unreadCount: 2, aiEnabled: true, lastMessageAt: "2026-04-07 09:32" },
  { id: "c2", leadId: "l2", leadName: "Yusuf Demir", channel: "Instagram", assignedTo: "Sarah Malik", status: "pending", unreadCount: 0, aiEnabled: false, lastMessageAt: "2026-04-07 08:14" },
  { id: "c3", leadId: "l3", leadName: "Emma Lee", channel: "Web Chat", assignedTo: "Arjun Patel", status: "open", unreadCount: 1, aiEnabled: true, lastMessageAt: "2026-04-07 07:54" },
];

export const mockMessages: Message[] = [
  { id: "m1", conversationId: "c1", sender: "user", text: "Hi, I want to know if your team handles female hairline restoration.", timestamp: "09:20" },
  { id: "m2", conversationId: "c1", sender: "ai", text: "Yes, we do. I can walk you through the consultation flow and expected recovery steps.", timestamp: "09:21" },
  { id: "m3", conversationId: "c1", sender: "user", text: "Can I see before/after examples?", timestamp: "09:22" },
  { id: "m4", conversationId: "c2", sender: "user", text: "What package includes hotel stay?", timestamp: "08:00" },
  { id: "m5", conversationId: "c2", sender: "human", text: "Our premium package includes airport transfer and hotel stay for 3 nights.", timestamp: "08:05" },
  { id: "m6", conversationId: "c3", sender: "user", text: "Need pricing and earliest appointment.", timestamp: "07:48" },
  { id: "m7", conversationId: "c3", sender: "ai", text: "I can share package ranges and available consultation slots this week.", timestamp: "07:49" },
];

export const mockPayments: PaymentRecord[] = [
  { id: "p1", tenantName: "Nova Hair Clinic", amount: 2499, status: "paid", date: "2026-04-01", method: "Card" },
  { id: "p2", tenantName: "Apex Smile Center", amount: 1499, status: "pending", date: "2026-04-03", method: "Bank Transfer" },
  { id: "p3", tenantName: "Luma Skin Studio", amount: 699, status: "failed", date: "2026-04-04", method: "Card" },
];

export const mockSubscriptions: SubscriptionRecord[] = [
  { id: "s1", tenantName: "Nova Hair Clinic", planName: "Growth AI", seats: 12, renewalDate: "2026-05-01", status: "active" },
  { id: "s2", tenantName: "Apex Smile Center", planName: "Scale", seats: 7, renewalDate: "2026-04-20", status: "trial" },
  { id: "s3", tenantName: "Luma Skin Studio", planName: "Starter", seats: 4, renewalDate: "2026-04-10", status: "past_due" },
];

export const mockPlans: PlanRecord[] = [
  { id: "plan1", name: "Starter", price: 699, features: ["CRM", "Inbox", "Basic Reports"] },
  { id: "plan2", name: "Growth AI", price: 2499, features: ["AI Chat", "Campaigns", "Automation"] },
  { id: "plan3", name: "Scale", price: 4999, features: ["Multi-seat", "Advanced Routing", "Priority Support"] },
];


export const mockIntegrationKeys: IntegrationKey[] = [
  { id: "ik1", provider: "WhatsApp Business", keyPreview: "wa_live_xxxx13", status: "connected", scope: "global" },
  { id: "ik2", provider: "Instagram Inbox", keyPreview: "ig_live_xxxx82", status: "connected", scope: "tenant" },
  { id: "ik3", provider: "Web Chat Widget", keyPreview: "web_live_xxxx91", status: "disconnected", scope: "tenant" },
];

export const mockCampaigns: Campaign[] = [
  { id: "cmp1", name: "Turkey Summer Leads", channel: "Instagram", budget: "₺3,500.00", status: "active" },
  { id: "cmp2", name: "UK Pricing Retargeting", channel: "Web", budget: "₺1,800.00", status: "draft" },
  { id: "cmp3", name: "Referral Win-back", channel: "WhatsApp", budget: "₺900.00", status: "paused" },
];

export const mockBillingSummary: BillingSummary = {
  currentPlan: "Growth AI",
  renewalDate: "2026-05-01",
  monthlySpend: "₺2,499.00",
  history: mockPayments,
};

export const mockTeamMembers: TeamMember[] = [
  { id: "tm1", name: "Sarah Malik", email: "owner@novaclinic.ai", role: "tenant_admin", status: "active" },
  { id: "tm2", name: "Arjun Patel", email: "staff@novaclinic.ai", role: "staff_user", status: "active" },
  { id: "tm3", name: "Nina Shah", email: "invite@novaclinic.ai", role: "staff_user", status: "invited" },
];

export const mockSuperAdminDashboard: SuperAdminDashboardData = {
  metrics: [
    { label: "Total Tenants", value: "128", change: "+12% this month", trend: "up" },
    { label: "MRR", value: "₺182K", change: "+8.4% QoQ", trend: "up" },
    { label: "Active Users", value: "2,436", change: "+215 last 30d", trend: "up" },
    { label: "Total Booked", value: "48", change: "Won Leads", trend: "up" },
  ],
  tenants: mockTenants,
  recentPayments: mockPayments,
  recentTickets: [
    { id: 1, subject: "WhatsApp webhook delay", status: "open", createdBy: "Sarah Malik", date: "2026-04-13" },
    { id: 2, subject: "Need invoice PDF", status: "in_progress", createdBy: "Arjun Patel", date: "2026-04-12" },
    { id: 3, subject: "Seat upgrade request", status: "closed", createdBy: "Nina Shah", date: "2026-04-10" },
  ],
};

export const mockTenantDashboard: TenantDashboardData = {
  metrics: [
    { label: "Leads", value: "342", change: "+24 today", trend: "up" },
    { label: "Conversions", value: "48", change: "+6.2% conversion", trend: "up" },
    { label: "Total Booked", value: "48", change: "Won leads only", trend: "up" },
    { label: "AI Chats", value: "189", change: "12 pending review", trend: "neutral" },
  ],
  funnel: [
    { label: "New", value: 140 },
    { label: "Qualified", value: 96 },
    { label: "Discussion", value: 51 },
    { label: "Won", value: 48 },
  ],
  recentLeads: [
    { id: "l1", name: "Ayesha Khan", source: "WhatsApp", stage: "new", date: "2026-04-13" },
    { id: "l2", name: "Ravi Sharma", source: "Instagram", stage: "qualified", date: "2026-04-12" },
    { id: "l3", name: "Lina Al-Farsi", source: "Web Chat", stage: "discussion", date: "2026-04-11" },
    { id: "l4", name: "James Cole", source: "WhatsApp", stage: "won", date: "2026-04-10" },
    { id: "l5", name: "Priya Patel", source: "Instagram", stage: "new", date: "2026-04-09" },
  ],
  recentTickets: [
    { id: "t1", subject: "Cannot upload patient documents", status: "open", date: "2026-04-13" },
    { id: "t2", subject: "Billing invoice not generated", status: "in_progress", date: "2026-04-12" },
    { id: "t3", subject: "AI chat not responding", status: "resolved", date: "2026-04-10" },
  ],
};
