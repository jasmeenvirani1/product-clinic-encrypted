import { api } from "@/utils/API";
import type { ApiResponse } from "@/types";

/**
 * Clinic Settings — per-tenant appointment scheduling config (open hours per
 * weekday, slot duration, buffer, AI-booking kill switch). Consumed by the AI
 * chat booking tool loop on the backend (check_availability/book_appointment)
 * and edited here via the Settings → Clinic Settings tab.
 * See `.ai/sessions/2026-08-10-ai-chat-book-appointment-google-calendar.md`
 * (GitHub Issue #40) for the full architecture and wire contract.
 */

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export interface ClinicScheduleDay {
  open: boolean;
  start: string; // "HH:mm", 24h
  end: string; // "HH:mm", 24h
}

export interface ClinicSchedule {
  id: number;
  tenant_id: number;
  timezone: string;
  monday: ClinicScheduleDay;
  tuesday: ClinicScheduleDay;
  wednesday: ClinicScheduleDay;
  thursday: ClinicScheduleDay;
  friday: ClinicScheduleDay;
  saturday: ClinicScheduleDay;
  sunday: ClinicScheduleDay;
  slot_duration_minutes: number;
  buffer_minutes: number;
  booking_enabled: boolean;
}

// Every field optional — partial update, mirrors aiSettingService.update's convention.
export interface UpdateClinicSchedulePayload {
  timezone?: string;
  monday?: Partial<ClinicScheduleDay>;
  tuesday?: Partial<ClinicScheduleDay>;
  wednesday?: Partial<ClinicScheduleDay>;
  thursday?: Partial<ClinicScheduleDay>;
  friday?: Partial<ClinicScheduleDay>;
  saturday?: Partial<ClinicScheduleDay>;
  sunday?: Partial<ClinicScheduleDay>;
  slot_duration_minutes?: number;
  buffer_minutes?: number;
  booking_enabled?: boolean;
}

export const clinicScheduleService = {
  async get(): Promise<ClinicSchedule> {
    const { data } = await api.get<ApiResponse<ClinicSchedule>>("/clinic-schedule");
    return data.data;
  },

  async update(payload: UpdateClinicSchedulePayload): Promise<ClinicSchedule> {
    const { data } = await api.put<ApiResponse<ClinicSchedule>>("/clinic-schedule", payload);
    return data.data;
  },
};
