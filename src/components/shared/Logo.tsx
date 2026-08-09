import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  href?: string;
  variant?: "default" | "light" | "dark";
  size?: "sm" | "md" | "lg";
}

const LOGO_SRC = "/brand/island-coolers-logo.png";

export function Logo({
  className,
  showText = true,
  href = "/",
  variant = "default",
  size = "md",
}: LogoProps) {
  const sizes = {
    sm: { img: 32, text: "text-sm", box: "h-8 w-8" },
    md: { img: 36, text: "text-base", box: "h-9 w-9" },
    lg: { img: 56, text: "text-xl", box: "h-14 w-14" },
  };
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative shrink-0 overflow-hidden", s.box)}>
        <Image
          src={LOGO_SRC}
          alt="Island Coolers"
          width={s.img}
          height={s.img}
          className="h-full w-full object-contain"
          priority
          unoptimized
        />
      </span>
      {showText && (
        <span
          className={cn(
            "font-bold tracking-tight",
            s.text,
            variant === "light" ? "text-white" : "text-navy"
          )}
        >
          Island Coolers
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0" aria-label="Island Coolers home">
        {content}
      </Link>
    );
  }
  return content;
}
