import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-light-blue">
        <Search className="h-6 w-6 text-sky" />
      </div>
      <h1 className="text-2xl font-bold text-navy">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That page doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-green px-4 text-sm font-medium text-white hover:bg-green/90"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link
          href="/menu"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-navy hover:bg-muted"
        >
          Browse menu
        </Link>
      </div>
    </div>
  );
}
