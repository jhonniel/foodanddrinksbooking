import { cn } from "@/lib/utils";

type CategoryLabelProps = {
  name: string;
  className?: string;
  /** Larger style for menu section headers */
  size?: "sm" | "md";
};

export function CategoryLabel({
  name,
  className,
  size = "sm",
}: CategoryLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full bg-sky/10 font-semibold uppercase tracking-wide text-sky ring-1 ring-sky/20",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-3 py-1 text-xs",
        className
      )}
    >
      {name}
    </span>
  );
}
