const sequelize = require("../config/database");
const Role = require("./Role");
const Menu = require("./Menu");
const Permission = require("./Permission");
const RoleMenuPermission = require("./RoleMenuPermission");
const User = require("./User");
const OtpCode = require("./OtpCode");
const Lead = require("./Lead");
const SupportTicket = require("./SupportTicket");
const Plan = require("./Plan");
const PaymentHistory = require("./PaymentHistory");
const Video = require("./Video");
const Campaign = require("./Campaign");
const Conversation = require("./Conversation");
const Message = require("./Message");
const AISetting = require("./AISetting");
const PlatformAISetting = require("./PlatformAISetting");
const FAQ = require("./FAQ");
const LeadSummary = require("./LeadSummary");
const ManagePage = require("./ManagePage");
const Invoice = require("./Invoice");
const ThemeSetting = require("./ThemeSetting");
const CustomField = require("./CustomField");
const TenantFieldPreference = require("./TenantFieldPreference");
const HeroContent = require("./HeroContent");
const LandingFaq = require("./LandingFaq");
const SeoSetting = require("./SeoSetting");
const Speciality = require("./Speciality");
const AiModel = require("./AiModel");
const Notification = require("./Notification");
const WhatsAppSession = require("./WhatsAppSession");
const InstagramSession = require("./InstagramSession");
const GoogleConnection = require("./GoogleConnection");
const InstagramReel = require("./InstagramReel");
const Lesson = require("./Lesson");
const LessonReel = require("./LessonReel");
const ClinicSchedule = require("./ClinicSchedule");
const Appointment = require("./Appointment");
const AiCredentialAlert = require("./AiCredentialAlert");

// User <-> Role
Role.hasMany(User, { foreignKey: "role_id" });
User.belongsTo(Role, { foreignKey: "role_id" });

// OtpCode <-> User
// User self association for tenant mapping
User.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant", constraints: false });
User.hasMany(User, { foreignKey: "tenant_id", as: "StaffMembers", constraints: false });
User.hasMany(OtpCode, { foreignKey: "user_id" });
OtpCode.belongsTo(User, { foreignKey: "user_id" });

// Role <-> Menu (many-to-many through RoleMenuPermission)
Role.belongsToMany(Menu, {
  through: RoleMenuPermission,
  foreignKey: "role_id",
  otherKey: "menu_id",
});
Menu.belongsToMany(Role, {
  through: RoleMenuPermission,
  foreignKey: "menu_id",
  otherKey: "role_id",
});

// RoleMenuPermission associations
RoleMenuPermission.belongsTo(Role, { foreignKey: "role_id" });
RoleMenuPermission.belongsTo(Menu, { foreignKey: "menu_id" });
RoleMenuPermission.belongsTo(Permission, { foreignKey: "permission_id" });
Role.hasMany(RoleMenuPermission, { foreignKey: "role_id" });
Menu.hasMany(RoleMenuPermission, { foreignKey: "menu_id" });
Permission.hasMany(RoleMenuPermission, { foreignKey: "permission_id" });

// Lead associations
User.hasMany(Lead, { foreignKey: "assigned_to", as: "assignedLeads" });
Lead.belongsTo(User, { foreignKey: "assigned_to", as: "AssignedUser" });

User.hasMany(Lead, { foreignKey: "created_by", as: "createdLeads" });
Lead.belongsTo(User, { foreignKey: "created_by", as: "CreatedByUser" });

// LeadSummary associations
Lead.hasMany(LeadSummary, { foreignKey: "lead_id", as: "Summaries" });
LeadSummary.belongsTo(Lead, { foreignKey: "lead_id", as: "Lead" });

// SupportTicket associations
User.hasMany(SupportTicket, { foreignKey: "created_by", as: "supportTickets" });
SupportTicket.belongsTo(User, { foreignKey: "created_by", as: "CreatedByUser" });

// Plan associations
Plan.hasMany(User, { foreignKey: "plan_id" });
User.belongsTo(Plan, { foreignKey: "plan_id" });

// PaymentHistory associations
User.hasMany(PaymentHistory, { foreignKey: "user_id", as: "paymentHistories" });
PaymentHistory.belongsTo(User, { foreignKey: "user_id", as: "User" });
Plan.hasMany(PaymentHistory, { foreignKey: "plan_id", as: "paymentHistories" });
PaymentHistory.belongsTo(Plan, { foreignKey: "plan_id", as: "Plan" });

// Video associations
User.hasMany(Video, { foreignKey: "uploaded_by", as: "uploadedVideos" });
Video.belongsTo(User, { foreignKey: "uploaded_by", as: "UploadedByUser" });
Menu.hasMany(Video, { foreignKey: "menu_id", as: "videos" });
Video.belongsTo(Menu, { foreignKey: "menu_id", as: "Menu" });

// Conversation associations
Lead.hasMany(Conversation, { foreignKey: "lead_id" });
Conversation.belongsTo(Lead, { foreignKey: "lead_id" });
User.hasMany(Conversation, { foreignKey: "assigned_to", as: "assignedConversations" });
Conversation.belongsTo(User, { foreignKey: "assigned_to", as: "AssignedUser" });

// Message associations
Conversation.hasMany(Message, { foreignKey: "conversation_id" });
Message.belongsTo(Conversation, { foreignKey: "conversation_id" });
User.hasMany(Message, { foreignKey: "sender_id", as: "sentMessages" });
Message.belongsTo(User, { foreignKey: "sender_id", as: "SenderUser" });
User.hasMany(Message, { foreignKey: "receiver_id", as: "receivedMessages" });
Message.belongsTo(User, { foreignKey: "receiver_id", as: "ReceiverUser" });

// Campaign associations
User.hasMany(Campaign, { foreignKey: "created_by", as: "createdCampaigns" });
Campaign.belongsTo(User, { foreignKey: "created_by", as: "CreatedByUser" });

// AISetting associations
User.hasOne(AISetting, { foreignKey: "tenant_id", as: "aiSetting" });
AISetting.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// Invoice associations
Invoice.belongsTo(Lead, { foreignKey: "lead_id", as: "Lead" });
Lead.hasMany(Invoice, { foreignKey: "lead_id", as: "Invoices" });

Invoice.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });
User.hasMany(Invoice, { foreignKey: "tenant_id", as: "receivedInvoices" });

Invoice.belongsTo(User, { foreignKey: "generated_by", as: "GeneratedBy" });
User.hasMany(Invoice, { foreignKey: "generated_by", as: "generatedInvoices" });

// Notification associations
User.hasMany(Notification, { foreignKey: "recipient_id", as: "receivedNotifications" });
Notification.belongsTo(User, { foreignKey: "recipient_id", as: "Recipient" });
User.hasMany(Notification, { foreignKey: "tenant_id", as: "tenantNotifications" });
Notification.belongsTo(User, { foreignKey: "tenant_id", as: "NotificationTenant" });

// WhatsAppSession associations (one tenant → many linked numbers/slots)
User.hasMany(WhatsAppSession, { foreignKey: "tenant_id", as: "whatsappSessions" });
WhatsAppSession.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// InstagramSession associations (one tenant → many linked IG accounts/slots)
User.hasMany(InstagramSession, { foreignKey: "tenant_id", as: "instagramSessions" });
InstagramSession.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// GoogleConnection associations (one tenant → many rows, one per service)
User.hasMany(GoogleConnection, { foreignKey: "tenant_id", as: "googleConnections" });
GoogleConnection.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// InstagramReel associations (one tenant → many synced reels)
User.hasMany(InstagramReel, { foreignKey: "tenant_id", as: "instagramReels" });
InstagramReel.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// Lesson associations (one tenant → many lessons)
User.hasMany(Lesson, { foreignKey: "tenant_id", as: "lessons" });
Lesson.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// Lesson <-> InstagramReel (many-to-many through LessonReel)
Lesson.belongsToMany(InstagramReel, {
  through: LessonReel,
  foreignKey: "lesson_id",
  otherKey: "instagram_reel_id",
  as: "reels",
});
InstagramReel.belongsToMany(Lesson, {
  through: LessonReel,
  foreignKey: "instagram_reel_id",
  otherKey: "lesson_id",
  as: "lessons",
});

// LessonReel direct associations (used for FK-level lookups, not eager loads)
LessonReel.belongsTo(Lesson, { foreignKey: "lesson_id" });
LessonReel.belongsTo(InstagramReel, { foreignKey: "instagram_reel_id" });

// ClinicSchedule associations (one tenant → one schedule row)
User.hasOne(ClinicSchedule, { foreignKey: "tenant_id", as: "clinicSchedule" });
ClinicSchedule.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

// Appointment associations
User.hasMany(Appointment, { foreignKey: "tenant_id", as: "appointments" });
Appointment.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });
Lead.hasMany(Appointment, { foreignKey: "lead_id", as: "appointments" });
Appointment.belongsTo(Lead, { foreignKey: "lead_id", as: "Lead" });
Conversation.hasMany(Appointment, { foreignKey: "conversation_id", as: "appointments" });
Appointment.belongsTo(Conversation, { foreignKey: "conversation_id", as: "Conversation" });

// AiCredentialAlert associations (dedup/cooldown state for issue #42's
// super_admin OpenAI-credential-failure alert)
User.hasMany(AiCredentialAlert, { foreignKey: "tenant_id", as: "aiCredentialAlerts" });
AiCredentialAlert.belongsTo(User, { foreignKey: "tenant_id", as: "Tenant" });

module.exports = {
  sequelize,
  Role,
  Menu,
  Permission,
  RoleMenuPermission,
  User,
  OtpCode,
  Lead,
  SupportTicket,
  Plan,
  PaymentHistory,
  Video,
  Campaign,
  Conversation,
  Message,
  AISetting,
  PlatformAISetting,
  FAQ,
  LeadSummary,
  ManagePage,
  Invoice,
  ThemeSetting,
  CustomField,
  TenantFieldPreference,
  HeroContent,
  LandingFaq,
  SeoSetting,
  Speciality,
  AiModel,
  Notification,
  WhatsAppSession,
  InstagramSession,
  GoogleConnection,
  InstagramReel,
  Lesson,
  LessonReel,
  ClinicSchedule,
  Appointment,
  AiCredentialAlert,
};


