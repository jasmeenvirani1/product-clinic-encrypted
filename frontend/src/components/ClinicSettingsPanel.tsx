"use client";

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { App, Card, InputNumber, Select, Spin, TimePicker } from "antd";
import dayjs from "dayjs";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { cn } from "@/lib/utils";
import {
  clinicScheduleService,
  WEEKDAYS,
  type ClinicSchedule,
  type ClinicScheduleDay,
  type UpdateClinicSchedulePayload,
  type Weekday,
} from "@/services/clinicSchedule.service";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
  sunday: "S",
};

const TIME_FORMAT = "HH:mm";

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
];

type DayDraft = ClinicScheduleDay;
type ScheduleDraft = Record<Weekday, DayDraft> & {
  timezone: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  booking_enabled: boolean;
};

interface DayGroup {
  key: string;
  days: Weekday[];
  open: boolean;
  start: string;
  end: string;
}

/** Collapses per-day config into groups of days that currently share identical hours. */
function groupsFromDraft(draft: Record<Weekday, DayDraft>): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const day of WEEKDAYS) {
    const d = draft[day];
    const existing = groups.find((g) => g.open === d.open && (!d.open || (g.start === d.start && g.end === d.end)));
    if (existing) {
      existing.days.push(day);
    } else {
      groups.push({ key: day, days: [day], open: d.open, start: d.start, end: d.end });
    }
  }
  return groups;
}

function toDraft(schedule: ClinicSchedule): ScheduleDraft {
  const days = WEEKDAYS.reduce((acc, day) => {
    acc[day] = { ...schedule[day] };
    return acc;
  }, {} as Record<Weekday, DayDraft>);
  return {
    ...days,
    timezone: schedule.timezone,
    slot_duration_minutes: schedule.slot_duration_minutes,
    buffer_minutes: schedule.buffer_minutes,
    booking_enabled: schedule.booking_enabled,
  };
}

export interface ClinicSettingsPanelHandle {
  /** Persist the current draft. Rejects if the load never succeeded. */
  save: () => Promise<void>;
  /** Whether there are unsaved changes right now. */
  hasChanges: () => boolean;
  /** Revert any unsaved draft back to the last-saved values. */
  discard: () => void;
}

interface ClinicSettingsPanelProps {
  /** Reports live unsaved-changes state up to the host's shared header Save button. */
  onDirtyChange?: (_dirty: boolean) => void;
}

export const ClinicSettingsPanel = forwardRef<ClinicSettingsPanelHandle, ClinicSettingsPanelProps>(
  function ClinicSettingsPanel({ onDirtyChange }, ref) {
    const { message } = App.useApp();

    const [saved, setSaved] = useState<ClinicSchedule | null>(null);
    const [draft, setDraft] = useState<ScheduleDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const schedule = await clinicScheduleService.get();
        setSaved(schedule);
        setDraft(toDraft(schedule));
      } catch {
        setLoadError(true);
        void message.error("Failed to load clinic settings.");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hasChanges = Boolean(saved && draft && JSON.stringify(toDraft(saved)) !== JSON.stringify(draft));

    useEffect(() => {
      onDirtyChange?.(hasChanges);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasChanges]);

    const groups = draft ? groupsFromDraft(draft) : [];

    /** Applies a patch to every day currently in this group. */
    const setGroup = (groupKey: string, patch: Partial<DayDraft>) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const group = groupsFromDraft(prev).find((g) => g.key === groupKey);
        if (!group) return prev;
        const next = { ...prev };
        group.days.forEach((day) => {
          next[day] = { ...next[day], ...patch };
        });
        return next;
      });
    };

    /** Moves a single day out of its current group and into its own new group with default hours. */
    const moveDayToOwnGroup = (day: Weekday) => {
      setDraft((prev) => (prev ? { ...prev, [day]: { open: true, start: "09:00", end: "17:00" } } : prev));
    };

    /** Moves a day into an existing group, adopting that group's hours. */
    const moveDayIntoGroup = (day: Weekday, targetGroup: DayGroup) => {
      setDraft((prev) =>
        prev ? { ...prev, [day]: { open: targetGroup.open, start: targetGroup.start, end: targetGroup.end } } : prev
      );
    };

    const discard = () => {
      if (saved) setDraft(toDraft(saved));
    };

    const handleSave = async () => {
      if (!draft || !saved || !hasChanges) {
        if (!hasChanges) void message.info("No changes to save.");
        return;
      }

      // Client-side HH:mm sanity check before hitting the backend's 400 validator.
      const invalidDay = WEEKDAYS.find((day) => {
        const d = draft[day];
        if (!d.open) return false;
        return !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end);
      });
      if (invalidDay) {
        void message.error(`Please set a valid open/close time for ${WEEKDAY_LABELS[invalidDay]}.`);
        return;
      }

      setSaving(true);
      try {
        const payload: UpdateClinicSchedulePayload = {
          timezone: draft.timezone,
          slot_duration_minutes: draft.slot_duration_minutes,
          buffer_minutes: draft.buffer_minutes,
          booking_enabled: draft.booking_enabled,
        };
        for (const day of WEEKDAYS) {
          payload[day] = draft[day];
        }
        const updated = await clinicScheduleService.update(payload);
        setSaved(updated);
        setDraft(toDraft(updated));
        void message.success("Clinic settings saved successfully!");
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to save clinic settings.";
        void message.error(msg);
      } finally {
        setSaving(false);
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        save: handleSave,
        hasChanges: () => hasChanges,
        discard,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [hasChanges, draft, saved]
    );

    if (loading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <Spin size="large" />
        </div>
      );
    }

    if (loadError || !draft) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-slate-500">Couldn&apos;t load clinic settings.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <Card size="small">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Weekly Hours</p>
          <p className="mb-3 text-xs text-slate-400">
            Group days that share the same hours. Click a day&apos;s letter to move it between groups.
          </p>
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.key} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const inThisGroup = group.days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={saving}
                          title={WEEKDAY_LABELS[day]}
                          aria-label={WEEKDAY_LABELS[day]}
                          aria-pressed={inThisGroup}
                          onClick={() => {
                            if (inThisGroup) {
                              if (group.days.length > 1) moveDayToOwnGroup(day);
                            } else {
                              moveDayIntoGroup(day, group);
                            }
                          }}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                            inThisGroup
                              ? "bg-primary text-white"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          )}
                        >
                          {WEEKDAY_SHORT[day]}
                        </button>
                      );
                    })}
                  </div>

                  <AppSwitch
                    checked={group.open}
                    onChange={(checked) => setGroup(group.key, { open: checked })}
                    disabled={saving}
                    aria-label={`${group.days.map((d) => WEEKDAY_LABELS[d]).join(", ")} open`}
                  />

                  {group.open ? (
                    <div className="flex items-center gap-2">
                      <TimePicker
                        value={dayjs(group.start, TIME_FORMAT)}
                        onChange={(value) => setGroup(group.key, { start: value ? value.format(TIME_FORMAT) : group.start })}
                        format={TIME_FORMAT}
                        minuteStep={5}
                        disabled={saving}
                        allowClear={false}
                        aria-label="Opening time"
                        className="w-28"
                      />
                      <span className="text-sm text-slate-400">to</span>
                      <TimePicker
                        value={dayjs(group.end, TIME_FORMAT)}
                        onChange={(value) => setGroup(group.key, { end: value ? value.format(TIME_FORMAT) : group.end })}
                        format={TIME_FORMAT}
                        minuteStep={5}
                        disabled={saving}
                        allowClear={false}
                        aria-label="Closing time"
                        className="w-28"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Closed</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {group.days.map((d) => WEEKDAY_LABELS[d]).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Booking Rules</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
              <Select
                value={draft.timezone}
                onChange={(value) => setDraft((prev) => (prev ? { ...prev, timezone: value } : prev))}
                options={TIMEZONE_OPTIONS}
                className="w-full"
                showSearch
                optionFilterProp="label"
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Slot Duration (minutes)</label>
              <InputNumber
                min={5}
                step={5}
                value={draft.slot_duration_minutes}
                onChange={(value) =>
                  setDraft((prev) => (prev ? { ...prev, slot_duration_minutes: value ?? prev.slot_duration_minutes } : prev))
                }
                className="w-full"
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Buffer Between Slots (minutes)</label>
              <InputNumber
                min={0}
                step={5}
                value={draft.buffer_minutes}
                onChange={(value) =>
                  setDraft((prev) => (prev ? { ...prev, buffer_minutes: value ?? prev.buffer_minutes } : prev))
                }
                className="w-full"
                disabled={saving}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
            <AppSwitch
              checked={draft.booking_enabled}
              onChange={(checked) => setDraft((prev) => (prev ? { ...prev, booking_enabled: checked } : prev))}
              disabled={saving}
              aria-label="AI booking enabled"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Allow AI chat to book appointments</p>
              <p className="text-xs text-slate-500">
                Turn this off to keep Google Calendar connected for staff while stopping the AI from auto-booking
                new appointments.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }
);
