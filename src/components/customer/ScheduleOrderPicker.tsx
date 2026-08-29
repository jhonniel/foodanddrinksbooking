"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StoreHoursSettings } from "@/lib/settings/types";
import {
  getAvailableScheduleDates,
  getScheduleTimeSlots,
  localDateTimeToUtc,
} from "@/lib/storeHours";

type FulfillmentTiming = "ASAP" | "SCHEDULED";

type ScheduleOrderPickerProps = {
  storeHours: StoreHoursSettings;
  fulfillmentTiming: FulfillmentTiming;
  scheduledAt: string | null;
  storeOpen: boolean;
  onTimingChange: (timing: FulfillmentTiming) => void;
  onScheduledAtChange: (iso: string | null) => void;
};

export function ScheduleOrderPicker({
  storeHours,
  fulfillmentTiming,
  scheduledAt,
  storeOpen,
  onTimingChange,
  onScheduledAtChange,
}: ScheduleOrderPickerProps) {
  const dates = useMemo(
    () => getAvailableScheduleDates(storeHours),
    [storeHours]
  );

  const [dateValue, setDateValue] = useState(dates[0]?.value ?? "");
  const timeSlots = useMemo(
    () => (dateValue ? getScheduleTimeSlots(storeHours, dateValue) : []),
    [storeHours, dateValue]
  );
  const [timeValue, setTimeValue] = useState(timeSlots[0]?.value ?? "");

  useEffect(() => {
    if (!storeOpen && fulfillmentTiming === "ASAP") {
      onTimingChange("SCHEDULED");
    }
  }, [storeOpen, fulfillmentTiming, onTimingChange]);

  useEffect(() => {
    if (dates.length && !dates.some((d) => d.value === dateValue)) {
      setDateValue(dates[0].value);
    }
  }, [dates, dateValue]);

  useEffect(() => {
    if (timeSlots.length && !timeSlots.some((s) => s.value === timeValue)) {
      setTimeValue(timeSlots[0].value);
    }
  }, [timeSlots, timeValue]);

  useEffect(() => {
    if (fulfillmentTiming !== "SCHEDULED" || !dateValue || !timeValue) {
      if (fulfillmentTiming === "ASAP") onScheduledAtChange(null);
      return;
    }
    const iso = localDateTimeToUtc(
      dateValue,
      timeValue,
      storeHours.timezone
    ).toISOString();
    onScheduledAtChange(iso);
  }, [
    fulfillmentTiming,
    dateValue,
    timeValue,
    storeHours.timezone,
    onScheduledAtChange,
  ]);

  useEffect(() => {
    if (!scheduledAt || fulfillmentTiming !== "SCHEDULED") return;
    const d = new Date(scheduledAt);
    const tz = storeHours.timezone;
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "09";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const timeStr = `${h}:${m}`;
    if (dates.some((item) => item.value === dateStr)) setDateValue(dateStr);
    if (timeSlots.some((item) => item.value === timeStr)) setTimeValue(timeStr);
  }, [scheduledAt, fulfillmentTiming, storeHours.timezone, dates, timeSlots]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-sky" />
        <h3 className="font-semibold text-navy">When do you want your order?</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!storeOpen}
          onClick={() => onTimingChange("ASAP")}
          className={cn(
            "rounded-2xl border-2 p-3 text-left transition-colors",
            fulfillmentTiming === "ASAP"
              ? "border-green bg-green/5"
              : "border-border bg-white shadow-card",
            !storeOpen && "cursor-not-allowed opacity-50"
          )}
        >
          <p className="text-sm font-semibold text-navy">As soon as possible</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {storeOpen ? "Prepare and deliver now" : "Unavailable while closed"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onTimingChange("SCHEDULED")}
          className={cn(
            "rounded-2xl border-2 p-3 text-left transition-colors",
            fulfillmentTiming === "SCHEDULED"
              ? "border-green bg-green/5"
              : "border-border bg-white shadow-card"
          )}
        >
          <p className="text-sm font-semibold text-navy">Schedule for later</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a date and time
          </p>
        </button>
      </div>

      {fulfillmentTiming === "SCHEDULED" && (
        <div className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-card sm:grid-cols-2">
          {dates.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              No open days available to schedule. Check store hours in Settings.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Date</Label>
                <Select value={dateValue} onValueChange={(v) => v && setDateValue(v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose date" />
                  </SelectTrigger>
                  <SelectContent>
                    {dates.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select
                  value={timeValue}
                  onValueChange={(v) => v && setTimeValue(v)}
                  disabled={timeSlots.length === 0}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
