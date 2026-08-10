"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { useAuthStore } from "@/stores/auth";
import { canAccessAdmin } from "@/lib/auth/config";
import {
  formatCurrency,
  formatDateTime,
  formatPoints,
  relativeTime,
} from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stagger, StaggerItem } from "@/components/motion";
import { isPhoneAuthEmail } from "@/lib/auth/phone";
import { cn } from "@/lib/utils";
import type { Order, PointsTransaction, Profile } from "@/types";

function customerEmailLabel(email: string) {
  if (!email || isPhoneAuthEmail(email)) return "—";
  return email;
}

type CustomerRow = Profile & {
  orderCount: number;
  totalSpent: number;
};

type LedgerPayload = {
  customer: Profile;
  orders: Order[];
  pointsLedger: PointsTransaction[];
  summary: {
    orderCount: number;
    deliveredCount: number;
    cancelledCount: number;
    totalSpent: number;
    pointsBalance: number;
    lifetimePoints: number;
    pointsEarnedTotal: number;
    pointsRedeemedTotal: number;
  };
};

export default function AdminCustomersPage() {
  const setCustomers = useDataStore((s) => s.setCustomers);
  const user = useAuthStore((s) => s.user);
  const authInitializing = useAuthStore((s) => s.initializing);

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [ledgerCustomer, setLedgerCustomer] = useState<CustomerRow | null>(
    null
  );
  const [ledger, setLedger] = useState<LedgerPayload | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetch("/api/customers", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as {
          customers?: CustomerRow[];
          error?: string;
        } | null;

        if (!res.ok) {
          if (!opts?.silent) {
            setLoadError(
              data?.error || `Could not load customers (${res.status}).`
            );
          }
          return;
        }

        const list = Array.isArray(data?.customers) ? data.customers : [];
        setRows(list);
        setCustomers(list);
        setLoadError(null);
      } catch {
        if (!opts?.silent) {
          setLoadError("Could not load customers from Supabase.");
        }
      } finally {
        setLoading(false);
        if (!opts?.silent) setRefreshing(false);
      }
    },
    [setCustomers]
  );

  useEffect(() => {
    if (authInitializing || !user || !canAccessAdmin(user.role)) return;
    void refresh();
    const id = window.setInterval(() => void refresh({ silent: true }), 15000);
    return () => window.clearInterval(id);
  }, [authInitializing, user, refresh]);

  const customerList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) =>
      [c.full_name, c.email, c.phone, c.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const openLedger = async (customer: CustomerRow) => {
    setLedgerCustomer(customer);
    setLedger(null);
    setLedgerError(null);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/ledger`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as
        | (LedgerPayload & { error?: string })
        | null;
      if (!res.ok || !data?.customer) {
        setLedgerError(data?.error || "Could not load customer ledger.");
        return;
      }
      setLedger(data);
    } catch {
      setLedgerError("Could not load customer ledger.");
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      toast.error("Full name is required.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
          phone: phone.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        customer?: CustomerRow;
        temporaryPassword?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.customer) {
        toast.error(data?.error || "Could not create customer in Supabase.");
        return;
      }

      toast.success(
        data.temporaryPassword
          ? `Customer created. Temp password: ${data.temporaryPassword}`
          : `Customer "${trimmedName}" added.`
      );
      setDialogOpen(false);
      resetForm();
      await refresh({ silent: true });
    } catch {
      toast.error("Could not create customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} users from Supabase
            {loadError ? ` · ${loadError}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90">
              <Plus className="h-4 w-4" />
              Add Customer
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="cust-name">Full Name *</Label>
                  <Input
                    id="cust-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Maria Santos"
                  />
                </div>
                <div>
                  <Label htmlFor="cust-email">Email *</Label>
                  <Input
                    id="cust-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maria@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cust-phone">Phone</Label>
                  <Input
                    id="cust-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 918 000 0000"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Saves to Supabase Auth + profiles. A temporary password is
                  generated if you do not set one.
                </p>
                <Button
                  className="w-full bg-green hover:bg-green/90"
                  onClick={() => void handleAddCustomer()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Customer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, phone…"
        className="mb-4 w-full max-w-md rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-sky/30 focus:ring-2"
      />

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Loading customers from Supabase…
          </p>
        ) : customerList.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {loadError || "No customers found in Supabase yet."}
          </p>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {customerList.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => void openLedger(customer)}
                  className="w-full rounded-xl border border-border p-4 text-left transition hover:border-sky/40 hover:bg-surface/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">
                        {customer.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.phone ??
                          customerEmailLabel(customer.email)}
                      </p>
                      {customer.phone &&
                        customer.email &&
                        !isPhoneAuthEmail(customer.email) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {customer.email}
                          </p>
                        )}
                      {!customer.phone &&
                        (!customer.email ||
                          isPhoneAuthEmail(customer.email)) && (
                          <p className="text-xs text-muted-foreground">
                            No phone
                          </p>
                        )}
                    </div>
                    <Badge
                      variant={customer.is_active ? "default" : "secondary"}
                    >
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-surface p-2">
                      <p className="text-muted-foreground">Points</p>
                      <p className="font-semibold text-sky">
                        {formatPoints(customer.points_balance)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                      <p className="text-muted-foreground">Orders</p>
                      <p className="font-semibold text-navy">
                        {customer.orderCount}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                      <p className="text-muted-foreground">Spent</p>
                      <p className="font-semibold text-green">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-sky">
                    <BookOpen className="h-3.5 w-3.5" />
                    View ledger
                  </p>
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Points</th>
                    <th className="px-5 py-3 font-medium">Lifetime Pts</th>
                    <th className="px-5 py-3 font-medium">Orders</th>
                    <th className="px-5 py-3 font-medium">Total Spent</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {customerList.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium text-navy">
                        {customer.full_name}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {customerEmailLabel(customer.email)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {customer.phone ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-light-blue px-2.5 py-0.5 text-xs font-medium text-sky">
                          {formatPoints(customer.points_balance)} pts
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatPoints(customer.lifetime_points)}
                      </td>
                      <td className="px-5 py-3">{customer.orderCount}</td>
                      <td className="px-5 py-3 font-medium text-green">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            customer.is_active ? "default" : "secondary"
                          }
                        >
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => void openLedger(customer)}
                        >
                          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Sheet
        open={!!ledgerCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setLedgerCustomer(null);
            setLedger(null);
            setLedgerError(null);
          }
        }}
      >
        <SheetContent className="w-full bg-surface sm:max-w-md">
          {ledgerCustomer && (
            <>
              <SheetHeader>
                <SheetTitle>{ledgerCustomer.full_name}</SheetTitle>
                <SheetDescription className="text-sm">
                  {[
                    ledgerCustomer.phone,
                    ledgerCustomer.email &&
                    !isPhoneAuthEmail(ledgerCustomer.email)
                      ? ledgerCustomer.email
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No contact on file"}
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-4">
                {ledgerLoading ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Loading ledger…
                  </p>
                ) : ledgerError ? (
                  <p className="py-16 text-center text-sm text-red-600">
                    {ledgerError}
                  </p>
                ) : ledger ? (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-2xl bg-sky/10 px-3.5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky">
                          Points balance
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-navy">
                          {formatPoints(ledger.summary.pointsBalance)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-green/10 px-3.5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-green">
                          Lifetime earned
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-navy">
                          {formatPoints(ledger.summary.lifetimePoints)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3.5 py-3 shadow-card">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Orders · spent
                        </p>
                        <p className="mt-1 text-sm font-semibold text-navy">
                          {ledger.summary.orderCount} ·{" "}
                          {formatCurrency(ledger.summary.totalSpent)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3.5 py-3 shadow-card">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Redeemed
                        </p>
                        <p className="mt-1 text-sm font-semibold text-navy">
                          {formatPoints(ledger.summary.pointsRedeemedTotal)} pts
                        </p>
                      </div>
                    </div>

                    <Tabs defaultValue="orders" className="space-y-3">
                      <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-white p-1 shadow-card">
                        <TabsTrigger
                          value="orders"
                          className="rounded-lg data-[state=active]:bg-green data-[state=active]:text-white"
                        >
                          <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                          Orders ({ledger.orders.length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="points"
                          className="rounded-lg data-[state=active]:bg-green data-[state=active]:text-white"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Points ({ledger.pointsLedger.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="orders" className="mt-0">
                        {ledger.orders.length === 0 ? (
                          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-card">
                            <p className="text-sm text-muted-foreground">
                              No orders yet.
                            </p>
                          </div>
                        ) : (
                          <Stagger className="space-y-2.5" fast>
                            {ledger.orders.map((order) => (
                              <StaggerItem key={order.id}>
                                <div className="rounded-2xl bg-white p-3.5 shadow-card">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-navy">
                                        #{order.order_number}
                                      </p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {formatDateTime(order.created_at)} ·{" "}
                                        {order.order_type === "PICKUP"
                                          ? "Pickup"
                                          : "Delivery"}
                                      </p>
                                    </div>
                                    <StatusBadge status={order.status} />
                                  </div>
                                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-sm">
                                    <span className="font-bold text-green">
                                      {formatCurrency(order.total)}
                                    </span>
                                    <span className="text-xs font-medium text-sky">
                                      +{formatPoints(order.points_earned)} pts
                                      {order.points_used > 0
                                        ? ` · −${formatPoints(order.points_used)} used`
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                              </StaggerItem>
                            ))}
                          </Stagger>
                        )}
                      </TabsContent>

                      <TabsContent value="points" className="mt-0">
                        {ledger.pointsLedger.length === 0 ? (
                          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-card">
                            <p className="text-sm text-muted-foreground">
                              No points activity yet.
                            </p>
                          </div>
                        ) : (
                          <Stagger className="space-y-2.5" fast>
                            {ledger.pointsLedger.map((tx) => (
                              <StaggerItem key={tx.id}>
                                <div className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-card">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-navy">
                                      {tx.description || tx.type}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {tx.type} · {relativeTime(tx.created_at)}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 text-sm font-bold tabular-nums",
                                      tx.points >= 0
                                        ? "text-green"
                                        : "text-red-600"
                                    )}
                                  >
                                    {tx.points >= 0 ? "+" : ""}
                                    {formatPoints(tx.points)}
                                  </span>
                                </div>
                              </StaggerItem>
                            ))}
                          </Stagger>
                        )}
                      </TabsContent>
                    </Tabs>
                  </>
                ) : null}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
