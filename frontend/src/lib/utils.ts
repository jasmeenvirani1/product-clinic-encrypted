import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDateTime(date: string | Date): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  const base = formatDate(parsed);
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${base} ${hours}:${minutes}`;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const numeric = Number(amount ?? 0);
  if (!Number.isFinite(numeric)) return "$0.00";
  return `$${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function buildQueryString(params: object): string {
  const searchParams = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}
