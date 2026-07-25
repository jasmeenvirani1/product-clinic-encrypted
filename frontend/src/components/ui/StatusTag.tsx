import { Tag } from "antd";

type StatusConfig = { label: string; color: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  // Payment
  paid:          { label: "Paid",        color: "#22C55E" },
  success:       { label: "Success",     color: "#22C55E" },
  pending:       { label: "Pending",     color: "#F5990B" },
  failed:        { label: "Failed",      color: "#EF4444" },
  refunded:      { label: "Refunded",    color: "#2563EB" },
  // User / Team
  active:        { label: "Active",      color: "#22C55E" },
  invited:       { label: "Invited",     color: "#2563EB" },
  inactive:      { label: "Inactive",    color: "#64748B" },
  suspended:     { label: "Suspended",   color: "#EF4444" },
  // Tenant
  trial:         { label: "Trial",       color: "#2563EB" },
  trialing:      { label: "Trialing",    color: "#2563EB" },
  cancelled:     { label: "Cancelled",   color: "#64748B" },
  expired:       { label: "Expired",     color: "#EF4444" },
  // Integration
  connected:     { label: "Connected",   color: "#22C55E" },
  disconnected:  { label: "Disconnected",color: "#64748B" },
  error:         { label: "Error",       color: "#EF4444" },
  // Campaign
  paused:        { label: "Paused",      color: "#F5990B" },
  ended:         { label: "Ended",       color: "#64748B" },
  draft:         { label: "Draft",       color: "#64748B" },
  scheduled:     { label: "Scheduled",   color: "#2563EB" },
  // Support
  open:          { label: "Open",        color: "#2563EB" },
  in_progress:   { label: "In Progress", color: "#F5990B" },
  "in-progress": { label: "In Progress", color: "#F5990B" },
  resolved:      { label: "Resolved",    color: "#22C55E" },
  closed:        { label: "Closed",      color: "#64748B" },
  // Subscription
  renewed:       { label: "Renewed",     color: "#22C55E" },
};

export function StatusTag({ status }: { status: string }) {
  const key = status?.toLowerCase();
  const cfg: StatusConfig = STATUS_MAP[key] ?? { label: status, color: "#64748B" };

  return (
    <Tag
      style={{
        color:       cfg.color,
        background:  `${cfg.color}18`,
        borderColor: `${cfg.color}40`,
        fontWeight:  500,
        borderRadius: 6,
        textTransform: "capitalize",
      }}
    >
      {cfg.label}
    </Tag>
  );
}

/** Drop-in render function for AntD table columns */
export const renderStatus = (status: string) => <StatusTag status={status} />;
