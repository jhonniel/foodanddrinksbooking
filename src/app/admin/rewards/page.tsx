"use client";

import { useState } from "react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import {
  deleteRewardRemote,
  saveRewardRemote,
  toggleRewardActiveRemote,
} from "@/services/rewardService";
import { formatPoints } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Reward } from "@/types";

export default function AdminRewardsPage() {
  const rewards = useDataStore((s) => s.rewards);
  const prependReward = useDataStore((s) => s.prependReward);
  const updateReward = useDataStore((s) => s.updateReward);
  const deleteReward = useDataStore((s) => s.deleteReward);
  const toggleRewardActive = useDataStore((s) => s.toggleRewardActive);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [discountValue, setDiscountValue] = useState("");

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPointsRequired("");
    setDiscountValue("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (reward: Reward) => {
    setEditing(reward);
    setName(reward.name);
    setDescription(reward.description ?? "");
    setPointsRequired(String(reward.points_required));
    setDiscountValue(
      reward.discount_value != null ? String(reward.discount_value) : ""
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const points = parseInt(pointsRequired, 10);
    const discount = discountValue ? parseFloat(discountValue) : undefined;

    if (!trimmedName) {
      toast.error("Reward name is required.");
      return;
    }
    if (!pointsRequired || isNaN(points) || points <= 0) {
      toast.error("Enter valid points required (greater than zero).");
      return;
    }
    if (discountValue && (isNaN(discount!) || discount! < 0)) {
      toast.error("Enter a valid discount value.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveRewardRemote({
        id: editing?.id,
        name: trimmedName,
        description: description.trim() || null,
        pointsRequired: points,
        discountValue: discount ?? null,
      });

      if (result.error || !result.reward) {
        toast.error(result.error || "Could not save reward.");
        return;
      }

      if (editing) {
        updateReward(editing.id, result.reward);
        toast.success(`"${trimmedName}" updated.`);
      } else {
        prependReward(result.reward);
        toast.success(`"${trimmedName}" reward created.`);
      }

      setDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reward: Reward) => {
    if (
      !window.confirm(
        `Delete “${reward.name}”? Customers will no longer see this reward.`
      )
    ) {
      return;
    }

    const result = await deleteRewardRemote(reward.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    deleteReward(reward.id);
    const { requestServerDataSync } = await import(
      "@/services/dataSyncService"
    );
    requestServerDataSync();
    toast.success(`"${reward.name}" deleted.`);
  };

  const handleToggleActive = async (id: string, rewardName: string) => {
    const reward = rewards.find((r) => r.id === id);
    const nextActive = reward ? !reward.is_active : true;

    const result = await toggleRewardActiveRemote(id, nextActive);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toggleRewardActive(id);
    toast.success(
      `"${rewardName}" is now ${nextActive ? "active" : "inactive"}.`
    );
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Manage loyalty rewards and redemption options
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <Button
            type="button"
            onClick={openCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Reward
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Reward" : "Add Reward"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="reward-name">Name *</Label>
                <Input
                  id="reward-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="₱50 Off Your Order"
                />
              </div>
              <div>
                <Label htmlFor="reward-desc">Description</Label>
                <Textarea
                  id="reward-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Redeem for a discount on your next order"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="reward-points">Points Required *</Label>
                <Input
                  id="reward-points"
                  type="number"
                  min="1"
                  value={pointsRequired}
                  onChange={(e) => setPointsRequired(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div>
                <Label htmlFor="reward-discount">Discount Value (₱)</Label>
                <Input
                  id="reward-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="50"
                />
              </div>
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleSave}
              >
                {editing ? "Save Changes" : "Save Reward"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => (
          <div
            key={reward.id}
            className="rounded-2xl bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-light-blue">
                <Gift className="h-5 w-5 text-sky" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Edit ${reward.name}`}
                  onClick={() => openEdit(reward)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/70 hover:bg-muted hover:text-navy"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${reward.name}`}
                  onClick={() => handleDelete(reward)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/80 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <Badge variant={reward.is_active ? "default" : "secondary"}>
                  {reward.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-navy">
              {reward.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {reward.description}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-sky">
                {formatPoints(reward.points_required)} pts required
              </span>
              {reward.discount_value != null && (
                <span className="text-sm text-green">
                  ₱{reward.discount_value} off
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <Label htmlFor={`reward-${reward.id}`}>Enabled</Label>
              <Switch
                id={`reward-${reward.id}`}
                checked={reward.is_active}
                onCheckedChange={() =>
                  handleToggleActive(reward.id, reward.name)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
