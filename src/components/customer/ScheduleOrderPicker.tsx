"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  parseScheduleLocalDateTime,
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

  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [initialized, setInitialized] = useState(false);
  const lastPublishedIsoRef = useRef<string | null>(null);

  const timeSlots = useMemo(
    () => (dateValue ? getScheduleTimeSlots(storeHours, dateValue) : []),
    [storeHours, dateValue]
  );

  useEffect(() => {
    if (!storeOpen && fulfillmentTiming === "ASAP") {
      onTimingChange("SCHEDULED");
    }
  }, [storeOpen, fulfillmentTiming, onTimingChange]);

  useEffect(() => {
    if (initialized || dates.length === 0) return;

    let nextDate = dates[0].value;
    let nextTime = getScheduleTimeSlots(storeHours, nextDate)[0]?.value ?? "";

    if (fulfillmentTiming === "SCHEDULED" && scheduledAt) {
      const parsed = parseScheduleLocalDateTime(
        scheduledAt,
        storeHours.timezone
      );
      if (parsed && dates.some((d) => d.value === parsed.date)) {
        nextDate = parsed.date;
        const slots = getScheduleTimeSlots(storeHours, nextDate);
        nextTime = slots.some((s) => s.value === parsed.time)
          ? parsed.time
          : (slots[0]?.value ?? nextTime);
      }
    }

    setInitialized(true);
    setDateValue(nextDate);
    setTimeValue(nextTime);
  }, [dates, fulfillmentTiming, scheduledAt, storeHours, initialized]);

  useEffect(() => {
    if (!initialized || dates.length === 0) return;
    if (dates.some((d) => d.value === dateValue)) return;
    setDateValue(dates[0].value);
  }, [dates, dateValue, initialized]);

  useEffect(() => {
    if (!initialized || timeSlots.length === 0) return;
    if (timeSlots.some((s) => s.value === timeValue)) return;
    setTimeValue(timeSlots[0].value);
  }, [timeSlots, timeValue, initialized]);

  useEffect(() => {
    if (!initialized) return;

    if (fulfillmentTiming === "ASAP") {
      lastPublishedIsoRef.current = null;
      onScheduledAtChange(null);
      return;
    }

    if (!dateValue || !timeValue) return;

    const iso = localDateTimeToUtc(
      dateValue,
      timeValue,
      storeHours.timezone
    ).toISOString();

    if (iso === lastPublishedIsoRef.current) return;
    lastPublishedIsoRef.current = iso;
    onScheduledAtChange(iso);
  }, [
    fulfillmentTiming,
    dateValue,
    timeValue,
    storeHours.timezone,
    onScheduledAtChange,
  ]);

  const scheduleReady = initialized && Boolean(dateValue && timeValue);

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
          ) : !scheduleReady ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Loading schedule options…
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Date</Label>
                <Select
                  value={dateValue}
                  onValueChange={(v) => {
                    if (!v || v === dateValue) return;
                    setDateValue(v);
                  }}
                >
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
                  onValueChange={(v) => {
                    if (!v || v === timeValue) return;
                    setTimeValue(v);
                  }}
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
