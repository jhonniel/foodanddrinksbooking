"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

function homePathForSession(role: string | undefined | null): string {
  if (role && ADMIN_ROLES.has(role)) return "/admin";
  if (role === "DRIVER") return "/driver";
  if (role) return "/home";
  return "/";
}

export default function MaintenancePage() {
  const reduce = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const leaveIfOpen = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as {
          settings?: { maintenance_mode?: boolean };
        } | null;
        if (cancelled || json?.settings?.maintenance_mode) return;

        const meRes = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const me = (await meRes.json().catch(() => null)) as {
          profile?: { role?: string };
        } | null;

        if (!cancelled) {
          router.replace(homePathForSession(me?.profile?.role));
        }
      } catch {
        /* ignore poll errors */
      }
    };

    void leaveIfOpen();
    const id = window.setInterval(() => void leaveIfOpen(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#9fd6f0]">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 py-6 sm:px-6">
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-white/25 blur-3xl"
              animate={{ x: [0, 18, 0], y: [0, 10, 0] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-10 bottom-16 h-64 w-64 rounded-full bg-[#176b3a]/20 blur-3xl"
              animate={{ x: [0, -14, 0], y: [0, -12, 0] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-5xl"
        >
          <Image
            src="/brand/coming-soon.png"
            alt="Island Coolers — Something cool is coming soon. Stay cool. Stay tuned."
            width={1600}
            height={1000}
            priority
            className="h-auto w-full rounded-2xl shadow-[0_24px_60px_rgba(15,45,80,0.28)]"
          />
        </motion.div>
      </div>
    </div>
  );
}
