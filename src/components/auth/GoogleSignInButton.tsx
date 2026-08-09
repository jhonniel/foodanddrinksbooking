"use client";

import { useSearchParams } from "next/navigation";

const googleEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true" ||
  Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

export function GoogleSignInButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const params = useSearchParams();
  const next = params.get("next") || "/home";
  const href = `/api/auth/google?next=${encodeURIComponent(next)}`;

  if (!googleEnabled) return null;

  return (
    <a
      href={href}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold text-navy transition hover:bg-muted"
    >
      <GoogleIcon />
      {label}
    </a>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.1 36.9 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

export function AuthDivider({ text = "or" }: { text?: string }) {
  if (!googleEnabled) return null;

  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
