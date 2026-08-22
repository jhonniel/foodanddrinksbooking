"use client";

import { useState } from "react";
import { ShieldPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { createStaffAccount, updateAccountRole } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types";

const STAFF_ROLES: { value: UserRole; label: string }[] = [
  { value: "STAFF", label: "Staff" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export default function AdminTeamPage() {
  const customers = useDataStore((s) => s.customers);
  const updateCustomer = useDataStore((s) => s.updateCustomer);

  const team = customers.filter((c) =>
    ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"].includes(c.role)
  );

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("STAFF");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("STAFF");
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error("Name, email, and password (8+ chars) are required.");
      return;
    }
    setSaving(true);
    const result = await createStaffAccount({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      role,
    });
    setSaving(false);

    if (!result.success || !result.profile) {
      toast.error(result.error ?? "Failed to create staff account.");
      return;
    }

    useDataStore.setState((s) => ({
      customers: [
        result.profile!,
        ...s.customers.filter((c) => c.id !== result.profile!.id),
      ],
    }));

    toast.success(`${result.profile.full_name} can now sign in.`);
    setOpen(false);
    reset();
  };

  const handleRoleChange = async (accountId: string, nextRole: UserRole) => {
    const result = await updateAccountRole(accountId, nextRole);
    if (!result.success || !result.profile) {
      toast.error(result.error ?? "Could not update role.");
      return;
    }
    updateCustomer(accountId, { role: nextRole });
    toast.success("Role updated.");
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Team</h1>
          <p className="text-sm text-muted-foreground">
            Create staff accounts and manage roles. Public signup is customer-only.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90">
            <ShieldPlus className="h-4 w-4" />
            Add staff
          </DialogTrigger>
          <DialogContent scrollable className="sm:max-w-md">
            <DialogStickyHeader>
              <DialogTitle>Create staff account</DialogTitle>
            </DialogStickyHeader>
            <DialogScrollBody>
            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => v && setRole(v as UserRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </DialogScrollBody>
            <DialogStickyFooter>
              <Button
                className="w-full bg-green hover:bg-green/90 sm:w-auto sm:min-w-[140px]"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create account"}
              </Button>
            </DialogStickyFooter>
          </DialogContent>
        </Dialog>
      </div>

      {team.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-card">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold text-navy">No staff accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The first registered account is Super Admin. Add more staff here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-navy">{member.full_name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <Select
                value={member.role}
                onValueChange={(v) =>
                  v && handleRoleChange(member.id, v as UserRole)
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
