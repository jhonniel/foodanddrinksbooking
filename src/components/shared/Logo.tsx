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
    sm: { img: 40, text: "text-base", box: "h-10 w-10" },
    md: { img: 48, text: "text-lg", box: "h-12 w-12" },
    lg: { img: 72, text: "text-2xl", box: "h-[4.5rem] w-[4.5rem]" },
  };
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
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
