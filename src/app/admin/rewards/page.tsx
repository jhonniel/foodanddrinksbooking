"use client";

import { useState } from "react";
import { Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminRewardsPage() {
  const rewards = useDataStore((s) => s.rewards);
  const addReward = useDataStore((s) => s.addReward);
  const toggleRewardActive = useDataStore((s) => s.toggleRewardActive);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [discountValue, setDiscountValue] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setPointsRequired("");
    setDiscountValue("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleAddReward = () => {
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

    addReward({
      name: trimmedName,
      description: description.trim() || undefined,
      pointsRequired: points,
      discountValue: discount,
    });

    toast.success(`"${trimmedName}" reward created.`);
    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = (id: string, rewardName: string) => {
    toggleRewardActive(id);
    const reward = rewards.find((r) => r.id === id);
    const nowActive = reward ? !reward.is_active : true;
    toast.success(
      `"${rewardName}" is now ${nowActive ? "active" : "inactive"}.`
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
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Reward
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Reward</DialogTitle>
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
                onClick={handleAddReward}
              >
                Save Reward
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
              <Badge variant={reward.is_active ? "default" : "secondary"}>
                {reward.is_active ? "Active" : "Inactive"}
              </Badge>
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
