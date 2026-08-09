import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-white shadow-card", className)}>
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-2 h-4 w-20" />
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
