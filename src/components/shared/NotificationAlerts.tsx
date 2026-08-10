"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  unlockNotificationAudio,
  requestNotificationPermission,
  getCustomerSoundPref,
  setCustomerSoundPref,
  playAlertSound,
} from "@/lib/notifications/alert";

/**
 * Admin / driver: no banner. Request browser permission and unlock audio
 * automatically (permission on load when allowed; audio on first interaction).
 */
export function AutoEnableStaffAlerts() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    void requestNotificationPermission().catch(() => {
      /* browser may defer until a gesture */
    });

    const arm = () => {
      void (async () => {
        try {
          await unlockNotificationAudio();
          await requestNotificationPermission();
        } catch {
          /* ignore */
        }
      })();
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
    };

    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });
    window.addEventListener("touchstart", arm, { once: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
    };
  }, []);

  return null;
}

export function CustomerSoundToggle() {
  const [pref, setPref] = useState<"soft" | "silent">("soft");

  useEffect(() => {
    setPref(getCustomerSoundPref());
  }, []);

  const toggle = async () => {
    await unlockNotificationAudio();
    const next = pref === "soft" ? "silent" : "soft";
    setCustomerSoundPref(next);
    setPref(next);
    if (next === "soft") {
      try {
        await playAlertSound("soft");
      } catch {
        /* ignore */
      }
    }
    toast.success(
      next === "soft" ? "Soft bell sound on" : "Notification sound muted"
    );
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-navy hover:bg-muted"
    >
      {pref === "soft" ? (
        <Volume2 className="h-4 w-4 text-green" />
      ) : (
        <VolumeX className="h-4 w-4 text-muted-foreground" />
      )}
      {pref === "soft" ? "Bell sound: On" : "Bell sound: Off"}
    </button>
  );
}
