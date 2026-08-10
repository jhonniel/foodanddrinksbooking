"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type Piece = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
};

const COLORS = [
  "#2D6A4F",
  "#40916C",
  "#52B788",
  "#1B4332",
  "#74C69D",
  "#95D5B2",
  "#0EA5E9",
  "#F4A261",
];

/**
 * Lightweight canvas confetti — fires once on mount (respects reduced motion).
 */
export function OrderCompleteConfetti({
  active,
  durationMs = 3200,
}: {
  active: boolean;
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!active || reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stopped = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || 360;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const w = () => canvas.clientWidth;
    const h = () => canvas.clientHeight;

    const pieces: Piece[] = [];
    const burst = (cx: number, cy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 4 + Math.random() * 7;
        pieces.push({
          x: cx,
          y: cy,
          w: 5 + Math.random() * 5,
          h: 7 + Math.random() * 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          color: COLORS[i % COLORS.length]!,
          life: 1,
        });
      }
    };

    burst(w() * 0.28, h() * 0.2, 36);
    burst(w() * 0.72, h() * 0.18, 36);
    for (let i = 0; i < 28; i++) {
      pieces.push({
        x: Math.random() * w(),
        y: -10 - Math.random() * 40,
        w: 4 + Math.random() * 4,
        h: 6 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        color: COLORS[i % COLORS.length]!,
        life: 1,
      });
    }

    const started = performance.now();

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - started;
      ctx.clearRect(0, 0, w(), h());

      for (const p of pieces) {
        p.vy += 0.12;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / durationMs);

        if (p.life <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life * 1.4);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w(), h());
      }
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active, durationMs, reduce]);

  if (!active || reduce) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden
    />
  );
}
