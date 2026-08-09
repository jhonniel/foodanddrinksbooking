"use client";

import Link from "next/link";
import {
  MapPin,
  ClipboardList,
  Gift,
  LogOut,
  ChevronRight,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, canAccessAdmin, canAccessDriver } from "@/stores/auth";
import { formatPoints } from "@/lib/utils/format";

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
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    window.location.href = "/login";
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

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white">
          {user.full_name.charAt(0)}
        </div>
        <div>
          <p className="text-lg font-bold text-navy">{user.full_name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.phone && (
            <p className="text-sm text-muted-foreground">{user.phone}</p>
          )}
          <p className="mt-1 text-sm font-medium text-green">
            {formatPoints(user.points_balance)} points
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {user.role.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 font-semibold text-navy">Personal Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Full Name</span>
            <span className="font-medium text-navy">{user.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-navy">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium text-navy">{user.phone ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 font-semibold text-navy">Saved Addresses</h2>
        <p className="text-sm text-muted-foreground">
          Add delivery addresses during checkout. Saved address management
          syncs with your account.
        </p>
        <div className="mt-3 flex items-start gap-3 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
          <span>No saved addresses yet.</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white px-4 py-2 shadow-card">
        <MenuLink href="/orders" icon={ClipboardList} label="My Orders" />
        <Separator />
        <MenuLink
          href="/rewards"
          icon={Gift}
          label="Rewards"
          description={`${formatPoints(user.points_balance)} points available`}
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
