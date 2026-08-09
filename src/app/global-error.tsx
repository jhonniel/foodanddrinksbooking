"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 font-sans">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_4px_20px_rgba(11,42,74,0.06)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-[#0B2A4A]">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            We hit an unexpected error. Please try again.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#176B3A] px-4 text-sm font-medium text-white hover:bg-[#176B3A]/90"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-[#0B2A4A] hover:bg-slate-50"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
