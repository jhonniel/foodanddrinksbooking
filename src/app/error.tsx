"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function Error({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <AlertCircle className="h-6 w-6 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-navy">Something went wrong</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Please try again. If the problem continues, return home and retry your request.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-lg bg-green px-4 text-sm font-medium text-white hover:bg-green/90"
        >
          Try again
        </button>
        <Link
          href="/home"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-navy hover:bg-muted"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
