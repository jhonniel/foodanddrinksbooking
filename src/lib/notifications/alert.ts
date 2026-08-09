"use client";

export type AlertSoundKind = "urgent" | "soft" | "silent";

const SOUND_SRC: Record<Exclude<AlertSoundKind, "silent">, string> = {
  urgent: "/sounds/urgent-alert.wav",
  soft: "/sounds/soft-bell.wav",
};

let unlocked = false;
let sharedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

/** Call from a user gesture so browsers allow playback later. */
export async function unlockNotificationAudio(): Promise<void> {
  if (typeof window === "undefined") return;
  const audio = getAudio();
  audio.src = SOUND_SRC.urgent;
  audio.volume = 0.01;
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    unlocked = true;
  } catch {
    // Still mark unlocked so later plays retry from a gesture
    unlocked = true;
  }
  audio.volume = 1;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function playUrgentAlert(): Promise<void> {
  await playAlertSound("urgent");
}

export async function playSoftBell(): Promise<void> {
  await playAlertSound("soft");
}

export async function playAlertSound(kind: AlertSoundKind): Promise<void> {
  if (kind === "silent") return;
  if (typeof window === "undefined") return;

  const src = SOUND_SRC[kind];
  // Fresh element each time avoids stuck/paused state across browsers
  const audio = new Audio(src);
  audio.volume = 1;
  audio.setAttribute("playsinline", "true");

  try {
    await audio.play();
    unlocked = true;
  } catch (err) {
    // Retry once after a tiny unlock attempt
    try {
      await unlockNotificationAudio();
      const retry = new Audio(src);
      retry.volume = 1;
      await retry.play();
      unlocked = true;
    } catch {
      const message =
        err instanceof Error ? err.message : "Audio play was blocked";
      throw new Error(
        `Could not play sound (${message}). Unmute this browser tab and try again.`
      );
    }
  }
}

export function showBrowserNotification(input: {
  title: string;
  body: string;
  tag?: string;
  href?: string;
}): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const n = new Notification(input.title, {
      body: input.body,
      tag: input.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      if (input.href) window.location.href = input.href;
      n.close();
    };
  } catch {
    /* ignore unsupported options */
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

const CUSTOMER_SOUND_KEY = "ic-customer-notif-sound";

export function getCustomerSoundPref(): "soft" | "silent" {
  if (typeof window === "undefined") return "soft";
  const v = localStorage.getItem(CUSTOMER_SOUND_KEY);
  return v === "silent" ? "silent" : "soft";
}

export function setCustomerSoundPref(value: "soft" | "silent"): void {
  localStorage.setItem(CUSTOMER_SOUND_KEY, value);
}
