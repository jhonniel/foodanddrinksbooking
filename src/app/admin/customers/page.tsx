"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { useAppStore } from "@/stores/app";
import { formatCurrency, formatPoints } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminCustomersPage() {
  const customers = useDataStore((s) => s.customers);
  const addCustomer = useDataStore((s) => s.addCustomer);
  const orders = useAppStore((s) => s.orders);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const customerList = useMemo(
    () =>
      customers
        .filter((c) => c.role === "CUSTOMER")
        .map((customer) => {
          const customerOrders = orders.filter(
            (o) => o.customer_id === customer.id
          );
          return {
            ...customer,
            orderCount: customerOrders.length,
            totalSpent: customerOrders.reduce((sum, o) => sum + o.total, 0),
          };
        }),
    [customers, orders]
  );

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleAddCustomer = () => {
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

    const duplicate = customers.some(
      (c) => c.email.toLowerCase() === trimmedEmail.toLowerCase()
    );
    if (duplicate) {
      toast.error("A customer with this email already exists.");
      return;
    }

    addCustomer({
      fullName: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() || undefined,
    });

    toast.success(`Customer "${trimmedName}" added.`);
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Customers</h1>
          <p className="text-sm text-muted-foreground">
            View customer profiles and loyalty activity
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
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
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleAddCustomer}
              >
                Save Customer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Mobile cards */}
        <div className="space-y-3 p-3 md:hidden">
          {customerList.map((customer) => (
            <div
              key={customer.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">
                    {customer.full_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customer.phone ?? "No phone"}
                  </p>
                </div>
                <Badge variant={customer.is_active ? "default" : "secondary"}>
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
                  <p className="font-semibold text-navy">{customer.orderCount}</p>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <p className="text-muted-foreground">Spent</p>
                  <p className="font-semibold text-green">
                    {formatCurrency(customer.totalSpent)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
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
              </tr>
            </thead>
            <tbody>
              {customerList.map((customer) => (
                <tr key={customer.id} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium text-navy">
                    {customer.full_name}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {customer.email}
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
                    <Badge variant={customer.is_active ? "default" : "secondary"}>
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
