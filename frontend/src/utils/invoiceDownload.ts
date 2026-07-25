import type { GeneratedInvoice } from "@/services/wonLeads.service";
import { APP_FULL_NAME } from "@/constants/brand";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
  AED: "د.إ",
  SAR: "﷼",
};

const fmtCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
    return `${sym}${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const safe = (v: unknown) =>
  v == null || v === "" ? "—" : String(v);

const STATUS_PALETTE: Record<string, { bg: string; fg: string; dot: string }> = {
  paid:  { bg: "#ecfdf5", fg: "#0f766e", dot: "#0f766e" },
  sent:  { bg: "#eff6ff", fg: "#1d4ed8", dot: "#3b82f6" },
  draft: { bg: "#f8fafc", fg: "#475569", dot: "#94a3b8" },
};

export const downloadWonLeadsInvoice = (inv: GeneratedInvoice) => {
  const statusKey = (inv.status ?? "sent").toLowerCase();
  const pal = STATUS_PALETTE[statusKey] ?? STATUS_PALETTE.sent;
  const amount = Number(inv.amount ?? 0);
  const formattedAmount = fmtCurrency(amount, inv.currency ?? "USD");
  const issueDate = fmtDate(inv.createdAt);
  // Invoice is FROM MedLeads → TO the tenant/clinic (platform fee per booked appointment)
  const patientName = safe(inv.Lead?.name ?? "Patient");
  const clinicName = safe(inv.Tenant?.clinic_name ?? inv.Tenant?.full_name ?? "Clinic");
  const clinicContactName = safe(inv.Tenant?.full_name ?? clinicName);
  const clinicEmail = safe(inv.Tenant?.email ?? null);
  const generatedBy = safe(inv.GeneratedBy?.full_name ?? `${APP_FULL_NAME} Admin`);
  const notes = inv.notes?.trim() || null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${inv.invoice_number} — ${APP_FULL_NAME}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
  }
  body { padding: 24px 16px 48px; }


  /* ── Invoice card ── */
  .invoice {
    max-width: 820px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 12px 32px rgba(15,23,42,0.08);
  }

  /* accent bar */
  .accent {
    height: 6px;
    background: linear-gradient(90deg, #1F9D8B 0%, #14b8a6 50%, #0f6f60 100%);
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 36px 48px 28px;
    gap: 24px;
    flex-wrap: wrap;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1F9D8B, #0f6f60);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 20px;
    letter-spacing: 0.03em;
    box-shadow: 0 6px 18px rgba(31,157,139,0.35);
    flex-shrink: 0;
  }
  .brand-name { font-size: 17px; font-weight: 700; color: #0f172a; }
  .brand-sub  { font-size: 11px; color: #64748b; letter-spacing: 0.09em; text-transform: uppercase; margin-top: 2px; }

  .invoice-meta { text-align: right; }
  .meta-label { font-size: 10px; color: #94a3b8; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
  .meta-number { font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin-top: 3px; }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: ${pal.bg};
    color: ${pal.fg};
    border: 1px solid ${pal.dot}33;
  }
  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${pal.dot};
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #e2e8f0 10%, #e2e8f0 90%, transparent);
    margin: 0 48px;
  }

  /* ── Parties ── */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 28px 48px;
  }
  .party {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 20px 22px;
  }
  .party h3 {
    margin: 0 0 10px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #94a3b8;
    font-weight: 600;
  }
  .party .p-name { font-size: 15px; font-weight: 700; color: #0f172a; }
  .party .p-line { font-size: 12.5px; color: #64748b; margin-top: 3px; }

  /* ── Meta grid ── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    padding: 0 48px 28px;
  }
  .meta-cell {
    border-top: 2px solid #f1f5f9;
    padding: 16px 0 0;
  }
  .meta-cell + .meta-cell { padding-left: 24px; border-left: 1px solid #f1f5f9; }
  .meta-cell .mc-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
  .meta-cell .mc-value { font-size: 13.5px; font-weight: 600; color: #0f172a; margin-top: 4px; }

  /* ── Items table ── */
  .table-wrap {
    padding: 0 48px;
  }
  table.items {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  table.items thead th {
    background: #f8fafc;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10.5px;
    font-weight: 600;
    text-align: left;
    padding: 13px 18px;
    border-bottom: 1px solid #e2e8f0;
  }
  table.items thead th:last-child { text-align: right; }
  table.items tbody td {
    padding: 20px 18px;
    font-size: 13.5px;
    color: #0f172a;
  }
  table.items tbody td.muted { color: #64748b; font-size: 12px; }
  table.items tbody td.right { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .item-title { font-weight: 600; font-size: 14px; }
  .item-sub { color: #64748b; font-size: 11.5px; margin-top: 3px; }

  /* ── Totals ── */
  .totals {
    display: flex;
    justify-content: flex-end;
    padding: 24px 48px 0;
  }
  .totals-box {
    width: 300px;
    background: linear-gradient(135deg, rgba(31,157,139,0.06), rgba(15,111,96,0.03));
    border: 1px solid rgba(31,157,139,0.2);
    border-radius: 14px;
    padding: 18px 22px;
  }
  .t-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #475569;
    padding: 5px 0;
  }
  .t-row.grand {
    border-top: 1px solid rgba(31,157,139,0.2);
    margin-top: 10px;
    padding-top: 14px;
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
  .t-row.grand .t-amt { color: #1F9D8B; font-size: 18px; }

  /* ── Notes ── */
  .notes-block {
    margin: 24px 48px 0;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 12px;
    padding: 16px 20px;
  }
  .notes-block .n-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #92400e; font-weight: 600; margin-bottom: 6px; }
  .notes-block .n-text { font-size: 13px; color: #78350f; line-height: 1.6; }

  /* ── Thanks ── */
  .thanks {
    margin: 24px 48px 0;
    padding: 16px 20px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(31,157,139,0.07), rgba(15,111,96,0.03));
    border: 1px solid rgba(31,157,139,0.15);
    font-size: 13px;
    color: #0f6f60;
    line-height: 1.6;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 28px;
    padding: 18px 48px 36px;
    border-top: 1px dashed #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
  }
  .footer-brand { font-weight: 600; color: #64748b; }

  @media print {
    body { background: #fff; padding: 0; }
    .invoice { box-shadow: none; border-radius: 0; }
  }
  @media (max-width: 640px) {
    .header, .parties, .meta-grid, .table-wrap, .totals, .notes-block, .thanks, .footer { padding-left: 22px; padding-right: 22px; }
    .divider { margin: 0 22px; }
    .parties { grid-template-columns: 1fr; }
    .meta-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>

<div class="invoice">
  <div class="accent"></div>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="logo">M</div>
      <div>
        <div class="brand-name">${APP_FULL_NAME}</div>
        <div class="brand-sub">AI-Powered Clinic CRM</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="meta-label">Invoice</div>
      <div class="meta-number">#${inv.invoice_number}</div>
      <div class="status-pill">
        <span class="status-dot"></span>
        ${statusKey.toUpperCase()}
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <h3>Billed To</h3>
      <div class="p-name">${clinicName}</div>
      <div class="p-line">${clinicContactName}</div>
      ${clinicEmail !== "—" ? `<div class="p-line">${clinicEmail}</div>` : ""}
    </div>
    <div class="party">
      <h3>Billed From</h3>
      <div class="p-name">${APP_FULL_NAME}</div>
      <div class="p-line">support@medleads.ai</div>
      <div class="p-line" style="margin-top:6px;font-size:11px;color:#94a3b8">AI-Powered Clinic CRM Platform</div>
    </div>
  </div>

  <!-- Meta grid -->
  <div class="meta-grid">
    <div class="meta-cell">
      <div class="mc-label">Issue Date</div>
      <div class="mc-value">${issueDate}</div>
    </div>
    <div class="meta-cell">
      <div class="mc-label">Generated By</div>
      <div class="mc-value">${generatedBy}</div>
    </div>
    <div class="meta-cell">
      <div class="mc-label">Booked Patient</div>
      <div class="mc-value">${patientName}</div>
    </div>
  </div>

  <!-- Items table -->
  <div class="table-wrap">
    <table class="items">
      <thead>
        <tr>
          <th style="width:50%">Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="item-title">Per-Appointment Booking Fee</div>
            <div class="item-sub">Successfully booked appointment · Patient: ${patientName}</div>
          </td>
          <td class="muted">1</td>
          <td class="muted">${formattedAmount}</td>
          <td class="right">${formattedAmount}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="t-row"><span>Subtotal</span><span>${formattedAmount}</span></div>
      <div class="t-row"><span>Tax</span><span>—</span></div>
      <div class="t-row grand"><span>Total Due</span><span class="t-amt">${formattedAmount}</span></div>
    </div>
  </div>

  ${notes ? `
  <!-- Notes -->
  <div class="notes-block">
    <div class="n-label">Notes</div>
    <div class="n-text">${notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>
  ` : ""}

  <!-- Thanks -->
  <div class="thanks">
    This invoice is raised by ${APP_FULL_NAME} for one successfully booked appointment
    facilitated through the platform. This document is computer-generated and does not require a signature.
    For billing queries, contact <strong>support@medleads.ai</strong>.
  </div>

  <!-- Footer -->
  <div class="footer">
    <span class="footer-brand">${APP_FULL_NAME}</span>
    <span>Invoice #${inv.invoice_number} · Issued ${issueDate}</span>
    <span>support@medleads.ai</span>
  </div>
</div>

</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.invoice_number}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
