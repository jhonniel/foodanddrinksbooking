"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { formatPoints } from "@/lib/utils/format";
import { useCardTilt } from "@/hooks/useCardTilt";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/island-coolers-logo.png";
const ICE_MARK_SRC = "/brand/island-coolers-ice.png";

export function PointsMembershipCard({
  points,
  memberName,
  loading = false,
  ready = false,
  className,
}: {
  points: number;
  memberName?: string | null;
  loading?: boolean;
  /** When true (data loaded), play the glare sweep once. */
  ready?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const firstName = memberName?.trim().split(/\s+/)[0] || "Member";
  const showGlare = ready && !loading && !reduce;
  const cardRef = useRef<HTMLDivElement>(null);

  const tiltEnabled = Boolean(ready && !loading && !reduce);
  const {
    tilt,
    enable,
    needsGesture,
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerDrag,
    onPointerUp,
  } = useCardTilt({
    enabled: tiltEnabled,
    maxTilt: 16,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    // First tap on iOS Safari grants motion permission (must be a user gesture)
    if (needsGesture) {
      e.preventDefault();
      void enable();
      return;
    }
    onPointerDown(e.clientX, e.clientY);
    try {
      cardRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    onPointerDrag(e.clientX, e.clientY);
    if (e.pointerType === "mouse") {
      onPointerMove(e.clientX, e.clientY, el.getBoundingClientRect());
    }
  };

  const shineX = 50 + tilt.rotateY * 2.2;
  const shineY = 45 - tilt.rotateX * 2.2;

  return (
    <motion.div
      className={cn("relative [perspective:1100px]", className)}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        ref={cardRef}
        role="presentation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        style={{
          transform: tiltEnabled
            ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
            : undefined,
          transformStyle: "preserve-3d",
          willChange: tiltEnabled ? "transform" : undefined,
        }}
        className={cn(
          "rewards-membership-card relative overflow-hidden rounded-[1.5rem]",
          "min-h-[11.5rem] w-full sm:min-h-[13rem]",
          "aspect-[1.55/1]",
          "shadow-[0_20px_50px_-18px_rgba(11,42,74,0.55)]",
          "transition-shadow duration-300",
          "touch-manipulation select-none"
        )}
      >
        {/* Depth layers */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(31,167,225,0.35),transparent_55%),radial-gradient(90%_70%_at_100%_100%,rgba(23,107,58,0.4),transparent_50%),linear-gradient(145deg,#071a30_0%,#0b2a4a_42%,#0e3d5c_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_35%,transparent_55%)]" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-green/30 blur-3xl" />

        {/* Glass panel */}
        <div className="absolute inset-[1px] rounded-[1.45rem] border border-white/20 bg-white/[0.06] backdrop-blur-xl" />

        {/* Icy mark fused into the card (blend + tint — not a flat pasted image) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[1.45rem]"
        >
          <div className="absolute right-[8%] top-[29%] h-[78%] w-[58%]">
            <Image
              src={ICE_MARK_SRC}
              alt=""
              fill
              className="rewards-ice-mark object-contain object-right"
              sizes="(max-width: 640px) 90vw, 480px"
              unoptimized
              priority
            />
          </div>
          {/* Color wash so the mark picks up card navy/sky instead of looking like a PNG */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-navy/20 to-navy/55" />
        </div>

        {/* Live specular highlight that follows tilt */}
        {tiltEnabled && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[2] opacity-70 mix-blend-soft-light transition-opacity"
            style={{
              background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)`,
            }}
          />
        )}

        {/* Opening glare sweep */}
        {showGlare && (
          <div key="glare-ready" className="rewards-card-glare" aria-hidden />
        )}

        <div
          className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-7"
          style={{ transform: "translateZ(28px)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold tracking-tight text-white sm:text-base">
              Island Coolers
            </p>
            <div
              className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden sm:h-[4.5rem] sm:w-[4.5rem]"
              style={{ transform: "translateZ(18px)" }}
            >
              <Image
                src={LOGO_SRC}
                alt="Island Coolers"
                width={72}
                height={72}
                className="h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                unoptimized
                priority
              />
            </div>
          </div>

          <div className="py-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90 sm:text-xs">
              Your points balance
            </p>
            <motion.div
              key={loading ? "loading" : points}
              className="relative mt-1"
              initial={reduce ? false : { opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: showGlare ? 0.08 : 0 }}
            >
              <span
                aria-hidden
                className="rewards-points-outline pointer-events-none absolute inset-0 font-heading text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl"
              >
                {loading ? "—" : formatPoints(points)}
              </span>
              <span className="rewards-points-value relative font-heading text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
                {loading ? "—" : formatPoints(points)}
              </span>
            </motion.div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                Member
              </p>
              <p className="truncate text-base font-semibold text-white/90 sm:text-lg">
                {firstName}
              </p>
            </div>
            <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur-md">
              Rewards Points
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
