"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  unlockNotificationAudio,
  requestNotificationPermission,
  getCustomerSoundPref,
  setCustomerSoundPref,
  playAlertSound,
  type AlertSoundKind,
} from "@/lib/notifications/alert";

/**
 * Asks for browser notification permission and unlocks audio
 * (required by browsers after a user gesture).
 * Only shown while permission is still undecided.
 */
export function EnableAlertsBanner({
  audience,
}: {
  audience: "admin" | "driver" | "customer";
}) {
  const [needPermission, setNeedPermission] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const soundKind: AlertSoundKind =
    audience === "customer" ? "soft" : "urgent";
  const soundSrc =
    soundKind === "urgent"
      ? "/sounds/urgent-alert.wav"
      : "/sounds/soft-bell.wav";

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      setNeedPermission(true);
    }
  }, []);

  const enable = async () => {
    try {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
        el.volume = 1;
        el.muted = false;
        await el.play();
      }
      await unlockNotificationAudio();
      const perm = await requestNotificationPermission();
      setNeedPermission(false);
      if (perm === "granted") {
        toast.success("Notifications enabled");
      } else {
        toast.message(
          "Browser alerts blocked — in-app sounds still work after you interact with the page."
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not enable alerts"
      );
    }
  };

  if (!needPermission) return null;

  const label =
    audience === "admin"
      ? "Enable sounds for new orders"
      : audience === "driver"
        ? "Enable sounds for new deliveries"
        : "Enable order notifications";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 sm:px-4">
      <audio ref={audioRef} src={soundSrc} preload="auto" playsInline />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-amber-950">
          <Bell className="h-4 w-4 shrink-0" />
          {label}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
          onClick={enable}
        >
          Enable alerts
        </Button>
      </div>
    </div>
  );
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
