"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import {
  removeInventoryRemote,
  saveInventoryRemote,
} from "@/services/catalogService";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { applyInventoryAvailabilityRules } from "@/services/inventoryService";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const UNITS = ["g", "ml", "pcs", "kg", "L"] as const;

export default function AdminInventoryPage() {
  const inventory = useDataStore((s) => s.inventory);
  const products = useDataStore((s) => s.products);
  const prependInventoryItem = useDataStore((s) => s.prependInventoryItem);
  const adjustInventory = useDataStore((s) => s.adjustInventory);
  const deleteInventoryItem = useDataStore((s) => s.deleteInventoryItem);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("pcs");
  const [currentQty, setCurrentQty] = useState("");
  const [minimumStock, setMinimumStock] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [supplier, setSupplier] = useState("");

  const isLow = (item: InventoryItem) =>
    item.current_quantity < item.minimum_stock;

  const isCritical = (item: InventoryItem) =>
    item.current_quantity < item.minimum_stock * 0.5;

  const lowCount = inventory.filter(isLow).length;

  const resetAddForm = () => {
    setName("");
    setUnit("pcs");
    setCurrentQty("");
    setMinimumStock("");
    setCostPerUnit("");
    setSupplier("");
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) resetAddForm();
  };

  const handleAddItem = async () => {
    const trimmedName = name.trim();
    const qty = parseFloat(currentQty);
    const min = parseFloat(minimumStock);
    const cost = costPerUnit ? parseFloat(costPerUnit) : undefined;

    if (!trimmedName) {
      toast.error("Item name is required.");
      return;
    }
    if (!currentQty || isNaN(qty) || qty < 0) {
      toast.error("Enter a valid current quantity.");
      return;
    }
    if (!minimumStock || isNaN(min) || min < 0) {
      toast.error("Enter a valid minimum stock level.");
      return;
    }
    if (costPerUnit && (isNaN(cost!) || cost! < 0)) {
      toast.error("Enter a valid cost per unit.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveInventoryRemote({
        name: trimmedName,
        unit,
        currentQuantity: qty,
        minimumStock: min,
        costPerUnit: cost,
        supplier: supplier.trim() || null,
      });

      if (result.error || !result.item) {
        toast.error(result.error || "Could not save inventory item.");
        return;
      }

      prependInventoryItem(result.item);
      toast.success(`"${trimmedName}" added to inventory.`);
      setAddDialogOpen(false);
      resetAddForm();
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustItem) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    setAdjusting(true);
    try {
      const result = await saveInventoryRemote({
        id: adjustItem.id,
        name: adjustItem.name,
        unit: adjustItem.unit,
        currentQuantity: qty,
        minimumStock: adjustItem.minimum_stock,
        costPerUnit: adjustItem.cost_per_unit,
        supplier: adjustItem.supplier,
        sku: adjustItem.sku,
      });

      if (result.error || !result.item) {
        toast.error(result.error || "Could not update stock.");
        return;
      }

      adjustInventory(adjustItem.id, qty);
      void applyInventoryAvailabilityRules().then((flipped) => {
        if (flipped.length > 0) {
          toast.warning(
            `${flipped.length} product${flipped.length > 1 ? "s" : ""} marked unavailable (ingredient out of stock).`
          );
        }
      });
      toast.success(
        `Stock for "${adjustItem.name}" updated to ${qty} ${adjustItem.unit}.`
      );
      setAdjustItem(null);
      setAdjustQty("");
    } finally {
      setAdjusting(false);
    }
  };

  const openAdjustDialog = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustQty(String(item.current_quantity));
  };

  const linkedProducts = useMemo(() => {
    if (!deleteTarget) return [];
    return products.filter((product) =>
      (product.recipes ?? []).some(
        (recipe) => recipe.inventory_item_id === deleteTarget.id
      )
    );
  }, [deleteTarget, products]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const name = deleteTarget.name;
    setDeleting(true);
    try {
      const result = await removeInventoryRemote(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error || "Could not delete inventory item.");
        return;
      }

      deleteInventoryItem(deleteTarget.id);
      setDeleteTarget(null);

      void applyInventoryAvailabilityRules().then((flipped) => {
        if (flipped.length > 0) {
          toast.warning(
            `${flipped.length} product${flipped.length > 1 ? "s" : ""} marked unavailable after ingredient removal.`
          );
        }
      });

      toast.success(`"${name}" removed from inventory.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Track stock levels and restock supplies
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {lowCount} item{lowCount > 1 ? "s" : ""} below minimum stock
            </div>
          )}
          <Dialog open={addDialogOpen} onOpenChange={handleAddOpenChange}>
            <DialogTrigger
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="inv-name">Name *</Label>
                  <Input
                    id="inv-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fresh Strawberries"
                  />
                </div>
                <div>
                  <Label>Unit *</Label>
                  <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="inv-qty">Current Qty *</Label>
                    <Input
                      id="inv-qty"
                      type="number"
                      min="0"
                      value={currentQty}
                      onChange={(e) => setCurrentQty(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inv-min">Minimum *</Label>
                    <Input
                      id="inv-min"
                      type="number"
                      min="0"
                      value={minimumStock}
                      onChange={(e) => setMinimumStock(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="inv-cost">Cost per Unit (₱)</Label>
                  <Input
                    id="inv-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="inv-supplier">Supplier</Label>
                  <Input
                    id="inv-supplier"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Island Fresh Co."
                  />
                </div>
                <Button
                  className="w-full bg-green hover:bg-green/90"
                  onClick={() => void handleAddItem()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete inventory item?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                linkedProducts.length > 0 ? (
                  <>
                    This will permanently remove{" "}
                    <span className="font-medium text-foreground">
                      {deleteTarget.name}
                    </span>{" "}
                    ({deleteTarget.sku}) from inventory. It is used in{" "}
                    {linkedProducts.length} product
                    {linkedProducts.length > 1 ? "s" : ""} (
                    {linkedProducts.map((p) => p.name).join(", ")}). The
                    ingredient will be removed from those recipes. This action
                    cannot be undone.
                  </>
                ) : (
                  <>
                    This will permanently remove{" "}
                    <span className="font-medium text-foreground">
                      {deleteTarget.name}
                    </span>{" "}
                    ({deleteTarget.sku}) from inventory. This action cannot be
                    undone.
                  </>
                )
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Mobile cards */}
        <div className="space-y-3 p-3 md:hidden">
          {inventory.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border p-4",
                isCritical(item) && "border-red-200 bg-red-50",
                isLow(item) && !isCritical(item) && "border-amber-200 bg-amber-50",
                !isLow(item) && "border-border bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isLow(item) && (
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isCritical(item) ? "text-red-600" : "text-amber-600"
                        )}
                      />
                    )}
                    <p className="truncate font-semibold text-navy">{item.name}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.sku} · {item.supplier ?? "No supplier"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAdjustDialog(item)}
                  >
                    Adjust
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white/80 p-2">
                  <p className="text-muted-foreground">Current</p>
                  <p
                    className={cn(
                      "font-bold",
                      isCritical(item)
                        ? "text-red-600"
                        : isLow(item)
                          ? "text-amber-700"
                          : "text-navy"
                    )}
                  >
                    {item.current_quantity.toLocaleString()} {item.unit}
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-2">
                  <p className="text-muted-foreground">Minimum</p>
                  <p className="font-semibold text-navy">
                    {item.minimum_stock.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-2">
                  <p className="text-muted-foreground">Cost</p>
                  <p className="font-semibold text-navy">
                    {formatCurrency(item.cost_per_unit)}
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
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Current</th>
                <th className="px-5 py-3 font-medium">Minimum</th>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Cost/Unit</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Last Restocked</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b last:border-0",
                    isCritical(item) && "bg-red-50",
                    isLow(item) && !isCritical(item) && "bg-amber-50"
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isLow(item) && (
                        <AlertTriangle
                          className={cn(
                            "h-4 w-4",
                            isCritical(item) ? "text-red-600" : "text-amber-600"
                          )}
                        />
                      )}
                      <span className="font-medium text-navy">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{item.sku}</td>
                  <td
                    className={cn(
                      "px-5 py-3 font-semibold",
                      isCritical(item)
                        ? "text-red-600"
                        : isLow(item)
                          ? "text-amber-700"
                          : "text-navy"
                    )}
                  >
                    {item.current_quantity.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    {item.minimum_stock.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">{item.unit}</td>
                  <td className="px-5 py-3">
                    {formatCurrency(item.cost_per_unit)}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {item.supplier ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatDate(item.last_restocked_at ?? item.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAdjustDialog(item)}
                      >
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={!!adjustItem}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustItem(null);
            setAdjustQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-sky" />
              Adjust Stock — {adjustItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="qty">
                New Quantity ({adjustItem?.unit}) *
              </Label>
              <Input
                id="qty"
                type="number"
                min="0"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Minimum stock: {adjustItem?.minimum_stock} {adjustItem?.unit}
            </p>
            <Button
              className="w-full bg-green hover:bg-green/90"
              onClick={() => void handleAdjust()}
              disabled={adjusting}
            >
              {adjusting ? "Saving…" : "Update Stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
