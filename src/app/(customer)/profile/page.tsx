"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ClipboardList,
  Gift,
  LogOut,
  ChevronRight,
  User,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, canAccessAdmin, canAccessDriver } from "@/stores/auth";
import { isPhoneAuthEmail } from "@/lib/auth/phone";
import { compressImageFile } from "@/lib/utils/compressImage";
import { formatPoints } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { SavedAddressesCard } from "@/components/customer/SavedAddressesCard";

function MenuLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: typeof User;
  label: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-muted"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-light-blue">
        <Icon className="h-5 w-5 text-sky" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-navy">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);

  const refreshPoints = useCallback(async () => {
    if (!user?.id) {
      setPointsBalance(null);
      setPointsLoading(false);
      return;
    }
    setPointsLoading(true);
    try {
      const res = await fetch("/api/me/points", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        pointsBalance?: number;
        lifetimePoints?: number;
      } | null;
      if (res.ok && data && typeof data.pointsBalance === "number") {
        setPointsBalance(data.pointsBalance);
        updateUser({
          points_balance: data.pointsBalance,
          lifetime_points: data.lifetimePoints,
        });
      } else {
        setPointsBalance(user.points_balance ?? 0);
      }
    } catch {
      setPointsBalance(user.points_balance ?? 0);
    } finally {
      setPointsLoading(false);
    }
  }, [user?.id, user?.points_balance, updateUser]);

  useEffect(() => {
    if (authInitializing) return;
    void refreshPoints();
  }, [authInitializing, refreshPoints]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const handleAvatarPick = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB before compression.");
      return;
    }

    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.72,
        mimeType: "image/jpeg",
      });

      const form = new FormData();
      form.append("file", compressed);
      form.append("bucket", "avatars");
      form.append("folder", user.id);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as {
        publicUrl?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.publicUrl) {
        toast.error(data?.error || "Could not upload photo.");
        setPreviewUrl(null);
        return;
      }

      updateUser({ avatar_url: data.publicUrl });
      setPreviewUrl(data.publicUrl);
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not upload photo."
      );
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-navy">Not signed in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage your profile and orders.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-xl bg-green px-4 text-sm font-medium text-white hover:bg-green/90"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const avatarSrc = previewUrl || user.avatar_url;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-8 text-center shadow-card">
        <div className="relative">
          <div
            className={cn(
              "relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-navy text-4xl font-bold text-white ring-4 ring-sky/15",
              uploading && "opacity-70"
            )}
          >
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={user.full_name}
                fill
                className="object-cover"
                sizes="112px"
                unoptimized={avatarSrc.startsWith("blob:")}
              />
            ) : (
              user.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload profile photo"
            className="absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-green text-white shadow-md ring-2 ring-white transition hover:bg-green/90 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => void handleAvatarPick(e.target.files?.[0])}
          />
        </div>

        <p className="mt-4 text-xl font-bold text-navy">{user.full_name}</p>
        {user.phone ? (
          <p className="mt-1 text-sm text-muted-foreground">{user.phone}</p>
        ) : user.email && !isPhoneAuthEmail(user.email) ? (
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        ) : null}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 font-semibold text-navy">Personal Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Full Name</span>
            <span className="font-medium text-navy">{user.full_name}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium text-navy">{user.phone ?? "—"}</span>
          </div>
          {user.email && !isPhoneAuthEmail(user.email) && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="break-all font-medium text-navy">{user.email}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Rewards points</p>
            <p className="text-2xl font-bold text-navy">
              {pointsLoading ? "—" : formatPoints(pointsBalance ?? 0)}
            </p>
          </div>
          <Link
            href="/rewards"
            className="inline-flex items-center rounded-xl bg-light-blue px-3 py-2 text-sm font-medium text-sky hover:bg-light-blue/80"
          >
            View history
          </Link>
        </div>
      </div>

      <SavedAddressesCard />

      <div className="rounded-2xl bg-white px-4 py-2 shadow-card">
        <MenuLink href="/orders" icon={ClipboardList} label="My Orders" />
        <Separator />
        <MenuLink
          href="/rewards"
          icon={Gift}
          label="Rewards"
          description="Points balance & history"
        />
      </div>

      {(canAccessAdmin(user.role) || canAccessDriver(user.role)) && (
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 font-semibold text-navy">Workspaces</h2>
          <div className="grid gap-2">
            {canAccessAdmin(user.role) && (
              <Link
                href="/admin"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-navy hover:bg-muted"
              >
                Open Admin Dashboard
              </Link>
            )}
            {canAccessDriver(user.role) && (
              <Link
                href="/driver"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-navy hover:bg-muted"
              >
                Open Driver App
              </Link>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleLogout}
        variant="outline"
        className="h-12 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Log Out
      </Button>
    </div>
  );
}
