export interface DaySchedule {
  enabled: boolean;
  /** 24-hour HH:mm */
  open: string;
  /** 24-hour HH:mm */
  close: string;
}

export interface StoreHoursSettings {
  /** When true, the weekly schedule controls when customers can checkout. */
  enabled: boolean;
  timezone: string;
  schedule: Record<string, DaySchedule>;
}

export interface AppSettings {
  maintenance_mode: boolean;
  /** When true, customers can browse the menu but cannot checkout. */
  purchase_soon_mode: boolean;
  store_hours: StoreHoursSettings;
  updated_at: string | null;
}

export const PURCHASE_SOON_MESSAGE =
  "Online ordering opens soon. You can browse the menu, but checkout is not available yet.";
