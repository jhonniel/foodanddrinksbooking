"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CardTilt = { rotateX: number; rotateY: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

function requiresOrientationPermission(): boolean {
  if (typeof window === "undefined") return false;
  const DOE = window.DeviceOrientationEvent as DeviceOrientationConstructor;
  return typeof DOE?.requestPermission === "function";
}

/**
 * Phone web: gyroscope tilt via deviceorientation.
 * iOS Safari needs a tap to grant permission.
 * If sensors are blocked (HTTP / denied), falls back to touch-drag / mouse.
 */
export function useCardTilt(opts: {
  enabled: boolean;
  maxTilt?: number;
}) {
  const { enabled, maxTilt = 14 } = opts;
  const [tilt, setTilt] = useState<CardTilt>({ rotateX: 0, rotateY: 0 });
  const [listening, setListening] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [gyroReady, setGyroReady] = useState(false);

  const target = useRef<CardTilt>({ rotateX: 0, rotateY: 0 });
  const current = useRef<CardTilt>({ rotateX: 0, rotateY: 0 });
  const base = useRef<{ beta: number; gamma: number } | null>(null);
  const raf = useRef<number | null>(null);
  const usingGyro = useRef(false);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const enabling = useRef(false);

  const tick = useCallback(() => {
    current.current = {
      rotateX: lerp(current.current.rotateX, target.current.rotateX, 0.14),
      rotateY: lerp(current.current.rotateY, target.current.rotateY, 0.14),
    };
    setTilt({ ...current.current });
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [enabled, tick]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Gyro APIs need a secure context (HTTPS or localhost).
    if (!window.isSecureContext) {
      setNeedsGesture(false);
      setListening(false);
      return;
    }

    if (requiresOrientationPermission()) {
      setNeedsGesture(true);
      return;
    }

    // Android Chrome / most mobile browsers — listen right away
    setListening(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !listening || typeof window === "undefined") return;

    let gotSample = false;
    const timeout = window.setTimeout(() => {
      // No orientation events (blocked / desktop) — keep touch/mouse fallback
      if (!gotSample) setNeedsGesture(false);
    }, 1800);

    const onOrient = (event: DeviceOrientationEvent) => {
      const beta = event.beta;
      const gamma = event.gamma;
      if (beta == null || gamma == null) return;

      gotSample = true;
      usingGyro.current = true;
      setGyroReady(true);
      setNeedsGesture(false);

      if (!base.current) {
        base.current = { beta, gamma };
      }

      const dBeta = beta - base.current.beta;
      const dGamma = gamma - base.current.gamma;

      target.current = {
        rotateX: clamp((-dBeta / 5.5) * 1.15, -maxTilt, maxTilt),
        rotateY: clamp((dGamma / 4.5) * 1.15, -maxTilt, maxTilt),
      };
    };

    window.addEventListener("deviceorientation", onOrient, true);
    // Some Android builds only fire the absolute variant
    window.addEventListener(
      "deviceorientationabsolute" as keyof WindowEventMap,
      onOrient as EventListener,
      true
    );

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("deviceorientation", onOrient, true);
      window.removeEventListener(
        "deviceorientationabsolute" as keyof WindowEventMap,
        onOrient as EventListener,
        true
      );
    };
  }, [enabled, listening, maxTilt]);

  const enable = useCallback(async () => {
    if (!enabled || typeof window === "undefined" || enabling.current) return;
    enabling.current = true;

    try {
      if (!window.isSecureContext) {
        setNeedsGesture(false);
        return;
      }

      const DOE = window.DeviceOrientationEvent as DeviceOrientationConstructor;
      if (typeof DOE?.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setNeedsGesture(false);
          return;
        }
      }

      base.current = null;
      usingGyro.current = false;
      setNeedsGesture(false);
      setListening(true);
    } catch {
      setNeedsGesture(false);
    } finally {
      enabling.current = false;
    }
  }, [enabled]);

  /** Desktop hover / mouse */
  const onPointerMove = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      if (!enabled || usingGyro.current || dragOrigin.current) return;
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      target.current = {
        rotateX: clamp((0.5 - py) * maxTilt * 1.35, -maxTilt, maxTilt),
        rotateY: clamp((px - 0.5) * maxTilt * 1.35, -maxTilt, maxTilt),
      };
    },
    [enabled, maxTilt]
  );

  const onPointerLeave = useCallback(() => {
    if (usingGyro.current) return;
    dragOrigin.current = null;
    target.current = { rotateX: 0, rotateY: 0 };
  }, []);

  /** Mobile web fallback: drag finger across the card */
  const onPointerDown = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled) return;
      if (needsGesture) {
        void enable();
        return;
      }
      if (usingGyro.current) return;
      dragOrigin.current = { x: clientX, y: clientY };
    },
    [enabled, needsGesture, enable]
  );

  const onPointerDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || usingGyro.current || !dragOrigin.current) return;
      const dx = clientX - dragOrigin.current.x;
      const dy = clientY - dragOrigin.current.y;
      target.current = {
        rotateX: clamp((-dy / 14) * 1.2, -maxTilt, maxTilt),
        rotateY: clamp((dx / 14) * 1.2, -maxTilt, maxTilt),
      };
    },
    [enabled, maxTilt]
  );

  const onPointerUp = useCallback(() => {
    if (usingGyro.current) return;
    dragOrigin.current = null;
    target.current = { rotateX: 0, rotateY: 0 };
  }, []);

  return {
    tilt,
    enable,
    needsGesture,
    listening,
    gyroReady,
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerDrag,
    onPointerUp,
  };
}
