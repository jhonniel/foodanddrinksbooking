import { z } from "zod";

/** Empty, zero, or invalid values mean unlimited redemptions. */
export function normalizeUsageLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export const optionalUsageLimitSchema = z.preprocess(
  (val) => (val === undefined ? undefined : normalizeUsageLimit(val)),
  z.union([z.number().int().min(1).max(100000), z.null()])
).optional();
