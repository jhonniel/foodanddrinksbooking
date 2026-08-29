import type { DaySchedule, StoreHoursSettings } from "@/lib/settings/types";

export const STORE_TIMEZONE = "Asia/Manila";

export const WEEKDAYS = [
  { key: 0, label: "Sunday", short: "Sun" },
  { key: 1, label: "Monday", short: "Mon" },
  { key: 2, label: "Tuesday", short: "Tue" },
  { key: 3, label: "Wednesday", short: "Wed" },
  { key: 4, label: "Thursday", short: "Thu" },
  { key: 5, label: "Friday", short: "Fri" },
  { key: 6, label: "Saturday", short: "Sat" },
] as const;

const DAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function defaultDay(open = "09:00", close = "21:00"): DaySchedule {
  return { enabled: true, open, close };
}

export const DEFAULT_STORE_HOURS: StoreHoursSettings = {
  enabled: true,
  timezone: STORE_TIMEZONE,
  schedule: {
    "0": defaultDay(),
    "1": defaultDay(),
    "2": defaultDay(),
    "3": defaultDay(),
    "4": defaultDay(),
    "5": defaultDay(),
    "6": defaultDay(),
  },
};

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function getDayOfWeekInTz(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return DAY_SHORT_TO_INDEX[weekday] ?? 0;
}

function getMinutesSinceMidnightInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function parseStoreHours(value: unknown): StoreHoursSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_STORE_HOURS };
  }

  const raw = value as Partial<StoreHoursSettings>;
  const schedule: StoreHoursSettings["schedule"] = {
    ...DEFAULT_STORE_HOURS.schedule,
  };

  if (raw.schedule && typeof raw.schedule === "object") {
    for (const day of WEEKDAYS) {
      const key = String(day.key);
      const entry = (raw.schedule as Record<string, Partial<DaySchedule>>)[key];
      if (!entry) continue;
      schedule[key] = {
        enabled: Boolean(entry.enabled),
        open:
          typeof entry.open === "string" && /^\d{2}:\d{2}$/.test(entry.open)
            ? entry.open
            : schedule[key].open,
        close:
          typeof entry.close === "string" && /^\d{2}:\d{2}$/.test(entry.close)
            ? entry.close
            : schedule[key].close,
      };
    }
  }

  return {
    enabled: Boolean(raw.enabled),
    timezone:
      typeof raw.timezone === "string" && raw.timezone.length > 0
        ? raw.timezone
        : STORE_TIMEZONE,
    schedule,
  };
}

export function formatTime12h(hm: string): string {
  const minutes = parseHm(hm);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function getDaySchedule(
  settings: StoreHoursSettings,
  dayIndex: number
): DaySchedule {
  return (
    settings.schedule[String(dayIndex)] ??
    DEFAULT_STORE_HOURS.schedule[String(dayIndex)]
  );
}

export function isStoreOpen(
  settings: StoreHoursSettings,
  now: Date = new Date()
): boolean {
  if (!settings.enabled) return true;

  const tz = settings.timezone || STORE_TIMEZONE;
  const dayIndex = getDayOfWeekInTz(now, tz);
  const day = getDaySchedule(settings, dayIndex);
  if (!day.enabled) return false;

  const nowMinutes = getMinutesSinceMidnightInTz(now, tz);
  const openMinutes = parseHm(day.open);
  const closeMinutes = parseHm(day.close);

  if (closeMinutes <= openMinutes) {
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }

  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

function findNextOpen(
  settings: StoreHoursSettings,
  from: Date
): { dayIndex: number; open: string } | null {
  const tz = settings.timezone || STORE_TIMEZONE;
  const startDay = getDayOfWeekInTz(from, tz);
  const startMinutes = getMinutesSinceMidnightInTz(from, tz);

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (startDay + offset) % 7;
    const day = getDaySchedule(settings, dayIndex);
    if (!day.enabled) continue;

    const openMinutes = parseHm(day.open);
    if (offset === 0 && startMinutes < openMinutes) {
      return { dayIndex, open: day.open };
    }
    if (offset > 0) {
      return { dayIndex, open: day.open };
    }
  }

  return null;
}

export function getStoreClosedMessage(
  settings: StoreHoursSettings,
  now: Date = new Date()
): string {
  if (!settings.enabled || isStoreOpen(settings, now)) {
    return "The store is currently closed. Please check back during our opening hours.";
  }

  const next = findNextOpen(settings, now);
  if (!next) {
    return "The store is currently closed. Online ordering is unavailable right now.";
  }

  const dayLabel = WEEKDAYS.find((d) => d.key === next.dayIndex)?.label ?? "soon";
  const timeLabel = formatTime12h(next.open);
  const tz = settings.timezone || STORE_TIMEZONE;
  const todayIndex = getDayOfWeekInTz(now, tz);
  const tomorrowIndex = (todayIndex + 1) % 7;

  if (next.dayIndex === todayIndex) {
    return `The store is closed. We open today at ${timeLabel}.`;
  }
  if (next.dayIndex === tomorrowIndex) {
    return `The store is closed. We open tomorrow at ${timeLabel}.`;
  }
  return `The store is closed. We open ${dayLabel} at ${timeLabel}.`;
}

export function formatWeeklySchedule(settings: StoreHoursSettings): string {
  const openDays = WEEKDAYS.filter((day) => getDaySchedule(settings, day.key).enabled);
  if (openDays.length === 0) return "Closed";

  const first = getDaySchedule(settings, openDays[0].key);
  const sameHours = openDays.every((day) => {
    const d = getDaySchedule(settings, day.key);
    return d.open === first.open && d.close === first.close;
  });

  const hoursLabel = `${formatTime12h(first.open)} – ${formatTime12h(first.close)}`;

  if (sameHours && openDays.length === 7) {
    return `Daily ${hoursLabel}`;
  }
  if (sameHours && openDays.length > 1) {
    return `${openDays[0].short}–${openDays[openDays.length - 1].short} ${hoursLabel}`;
  }

  return openDays
    .map((day) => {
      const d = getDaySchedule(settings, day.key);
      return `${day.short} ${formatTime12h(d.open)}–${formatTime12h(d.close)}`;
    })
    .join(", ");
}
