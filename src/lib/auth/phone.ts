/** Auth uses email under the hood; customers sign up with phone only. */
export const PHONE_AUTH_EMAIL_DOMAIN = "phone.islandcoolers.local";

/** Strip to digits and normalize common PH mobile formats to 63XXXXXXXXXX. */
export function normalizePhoneDigits(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0") && digits.length === 11) {
    digits = `63${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("9")) {
    digits = `63${digits}`;
  }

  // PH mobile: 63 + 10 digits; allow other intl ≥10 digits as-is
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function formatPhoneE164(digits: string): string {
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function isPhoneAuthEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PHONE_AUTH_EMAIL_DOMAIN}`);
}

export function phoneToAuthEmail(phoneInput: string): string | null {
  const digits = normalizePhoneDigits(phoneInput);
  if (!digits) return null;
  return `${digits}@${PHONE_AUTH_EMAIL_DOMAIN}`;
}

/** Login accepts a real email or a phone number (mapped to synthetic auth email). */
export function resolveLoginEmail(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  return phoneToAuthEmail(trimmed);
}

export function isPhoneLike(value: string): boolean {
  const t = value.trim();
  if (!t || t.includes("@")) return false;
  return normalizePhoneDigits(t) != null;
}
