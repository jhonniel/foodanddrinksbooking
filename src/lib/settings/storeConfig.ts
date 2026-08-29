import { DELIVERY_CONFIG, STORE_LOCATION } from "@/data/demo";
import type { DeliverySettings, StoreInfoSettings } from "./types";

export const DEFAULT_STORE_INFO: StoreInfoSettings = {
  name: STORE_LOCATION.name,
  address: STORE_LOCATION.address,
  phone: STORE_LOCATION.phone,
  lat: STORE_LOCATION.lat,
  lng: STORE_LOCATION.lng,
  hours: STORE_LOCATION.hours,
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  baseFee: DELIVERY_CONFIG.baseFee,
  baseKm: DELIVERY_CONFIG.baseKm,
  perKmFee: DELIVERY_CONFIG.perKmFee,
  freeAbove: DELIVERY_CONFIG.freeAbove,
  radiusKm: DELIVERY_CONFIG.radiusKm,
  baseMinutes: DELIVERY_CONFIG.baseMinutes,
  minutesPerKm: DELIVERY_CONFIG.minutesPerKm,
  estimatedMinutes: DELIVERY_CONFIG.estimatedMinutes,
};

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseStoreInfo(value: unknown): StoreInfoSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_STORE_INFO };
  }
  const raw = value as Partial<StoreInfoSettings>;
  return {
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : DEFAULT_STORE_INFO.name,
    address:
      typeof raw.address === "string" && raw.address.trim()
        ? raw.address.trim()
        : DEFAULT_STORE_INFO.address,
    phone:
      typeof raw.phone === "string" && raw.phone.trim()
        ? raw.phone.trim()
        : DEFAULT_STORE_INFO.phone,
    lat: num(raw.lat, DEFAULT_STORE_INFO.lat),
    lng: num(raw.lng, DEFAULT_STORE_INFO.lng),
    hours:
      typeof raw.hours === "string" && raw.hours.trim()
        ? raw.hours.trim()
        : DEFAULT_STORE_INFO.hours,
  };
}

export function parseDeliverySettings(value: unknown): DeliverySettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_DELIVERY_SETTINGS };
  }
  const raw = value as Partial<DeliverySettings> & {
    fee?: number;
    free_above?: number;
    radius_km?: number;
    estimated_minutes?: number;
  };

  return {
    baseFee: num(raw.baseFee ?? raw.fee, DEFAULT_DELIVERY_SETTINGS.baseFee),
    baseKm: num(raw.baseKm, DEFAULT_DELIVERY_SETTINGS.baseKm),
    perKmFee: num(raw.perKmFee, DEFAULT_DELIVERY_SETTINGS.perKmFee),
    freeAbove: num(
      raw.freeAbove ?? raw.free_above,
      DEFAULT_DELIVERY_SETTINGS.freeAbove
    ),
    radiusKm: num(raw.radiusKm ?? raw.radius_km, DEFAULT_DELIVERY_SETTINGS.radiusKm),
    baseMinutes: num(raw.baseMinutes, DEFAULT_DELIVERY_SETTINGS.baseMinutes),
    minutesPerKm: num(raw.minutesPerKm, DEFAULT_DELIVERY_SETTINGS.minutesPerKm),
    estimatedMinutes: num(
      raw.estimatedMinutes ?? raw.estimated_minutes,
      DEFAULT_DELIVERY_SETTINGS.estimatedMinutes
    ),
  };
}
