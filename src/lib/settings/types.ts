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

export interface StoreInfoSettings {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  hours: string;
}

export interface DeliverySettings {
  baseFee: number;
  baseKm: number;
  perKmFee: number;
  freeAbove: number;
  radiusKm: number;
  baseMinutes: number;
  minutesPerKm: number;
  estimatedMinutes: number;
}

export interface AppSettings {
  maintenance_mode: boolean;
  /** When true, customers can browse the menu but cannot checkout. */
  purchase_soon_mode: boolean;
  store_hours: StoreHoursSettings;
  store: StoreInfoSettings;
  delivery: DeliverySettings;
  updated_at: string | null;
}

export const PURCHASE_SOON_MESSAGE =
  "Online ordering opens soon. You can browse the menu, but checkout is not available yet.";
