"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { formatCurrency, formatDate } from "@/lib/utils/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PromotionType } from "@/types";

export default function AdminPromotionsPage() {
  const promotions = useDataStore((s) => s.promotions);
  const addPromotion = useDataStore((s) => s.addPromotion);
  const togglePromotionActive = useDataStore((s) => s.togglePromotionActive);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [type, setType] = useState<PromotionType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setPromoCode("");
    setType("PERCENTAGE");
    setDiscountValue("");
    setMinOrderAmount("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleAddPromotion = () => {
    const trimmedName = name.trim();
    const code = promoCode.trim();
    const discount = parseFloat(discountValue);
    const minOrder = minOrderAmount ? parseFloat(minOrderAmount) : undefined;

    if (!trimmedName) {
      toast.error("Promotion name is required.");
      return;
    }
    if (!code) {
      toast.error("Promo code is required.");
      return;
    }
    if (!discountValue || isNaN(discount) || discount <= 0) {
      toast.error("Enter a valid discount value greater than zero.");
      return;
    }
    if (type === "PERCENTAGE" && discount > 100) {
      toast.error("Percentage discount cannot exceed 100%.");
      return;
    }
    if (minOrderAmount && (isNaN(minOrder!) || minOrder! < 0)) {
      toast.error("Enter a valid minimum order amount.");
      return;
    }

    addPromotion({
      name: trimmedName,
      description: description.trim() || undefined,
      promoCode: code,
      type,
      discountValue: discount,
      minOrderAmount: minOrder,
    });

    toast.success(`Promotion "${trimmedName}" (${code.toUpperCase()}) created.`);
    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = (id: string, promoName: string) => {
    togglePromotionActive(id);
    const promo = promotions.find((p) => p.id === id);
    const nowActive = promo ? !promo.is_active : true;
    toast.success(
      `"${promoName}" is now ${nowActive ? "active" : "inactive"}.`
    );
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Manage promo codes and discount campaigns
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Promotion
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Promotion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="promo-name">Name *</Label>
                <Input
                  id="promo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Summer Splash Sale"
                />
              </div>
              <div>
                <Label htmlFor="promo-desc">Description</Label>
                <Textarea
                  id="promo-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Limited-time island cooler discount"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="promo-code">Promo Code *</Label>
                <Input
                  id="promo-code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ISLAND20"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={type}
                  onValueChange={(v) => v && setType(v as PromotionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount (₱)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="promo-discount">
                  Discount Value * ({type === "PERCENTAGE" ? "%" : "₱"})
                </Label>
                <Input
                  id="promo-discount"
                  type="number"
                  min="0"
                  step={type === "PERCENTAGE" ? "1" : "0.01"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={type === "PERCENTAGE" ? "20" : "100"}
                />
              </div>
              <div>
                <Label htmlFor="promo-min">Minimum Order (₱)</Label>
                <Input
                  id="promo-min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="500"
                />
              </div>
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleAddPromotion}
              >
                Save Promotion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {promotions.map((promo) => (
          <div
            key={promo.id}
            className="rounded-2xl bg-white p-5 shadow-card"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-light-blue">
                  <Megaphone className="h-6 w-6 text-sky" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-navy">
                      {promo.name}
                    </h3>
                    <Badge className="bg-green font-mono">
                      {promo.promo_code}
                    </Badge>
                    <Badge variant={promo.is_active ? "default" : "secondary"}>
                      {promo.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {promo.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span>
                      Discount:{" "}
                      {promo.type === "PERCENTAGE"
                        ? `${promo.discount_value}%`
                        : formatCurrency(promo.discount_value ?? 0)}
                    </span>
                    {promo.min_order_amount > 0 && (
                      <span>
                        Min order: {formatCurrency(promo.min_order_amount)}
                      </span>
                    )}
                    <span>
                      Valid: {formatDate(promo.starts_at)} –{" "}
                      {formatDate(promo.ends_at)}
                    </span>
                    <span className="text-muted-foreground">
                      Used: {promo.usage_count} times
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`promo-${promo.id}`}>Enabled</Label>
                <Switch
                  id={`promo-${promo.id}`}
                  checked={promo.is_active}
                  onCheckedChange={() =>
                    handleToggleActive(promo.id, promo.name)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
