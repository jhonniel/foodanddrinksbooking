"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { getProductById } from "@/services/productService";
import { resolveMixPickerOptions } from "@/lib/catalog/mixMatch";
import { isProductOrderable } from "@/lib/inventory/availability";
import {
  getMaxQuantityForCartLine,
  maxStockToastMessage,
} from "@/lib/cart/stockLimits";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type {
  CartItem,
  CartItemAddon,
  CartItemMixComponent,
  CartItemOption,
  Product,
  ProductAddon,
  ProductOption,
} from "@/types";

function OptionSelector({
  option,
  selectedValueId,
  onSelect,
}: {
  option: ProductOption;
  selectedValueId: string;
  onSelect: (valueId: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-navy">{option.display_name}</h3>
      <div className="flex flex-wrap gap-2">
        {option.values?.map((val) => (
          <button
            key={val.id}
            type="button"
            disabled={!val.is_available}
            onClick={() => onSelect(val.id)}
            className={cn(
              "min-h-10 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedValueId === val.id
                ? "bg-green text-white"
                : "bg-muted text-navy hover:bg-muted/80",
              !val.is_available && "cursor-not-allowed opacity-50"
            )}
          >
            {val.name}
            {val.price_adjustment > 0 && (
              <span className="ml-1 text-xs opacity-80">
                +{formatCurrency(val.price_adjustment)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function initStateFromCartItem(item: CartItem) {
  const selectedOptions: Record<string, string> = {};
  for (const opt of item.options ?? []) {
    selectedOptions[opt.optionId] = opt.valueId;
  }

  const selectedAddons: Record<string, number> = {};
  for (const addon of item.addons ?? []) {
    if (addon.quantity > 0) selectedAddons[addon.addonId] = addon.quantity;
  }

  const mixSlotProductIds = (item.mixComponents ?? [])
    .filter((m) => m.productId !== item.productId)
    .map((m) => m.productId);

  return {
    selectedOptions,
    selectedAddons,
    mixSlotProductIds,
    quantity: item.quantity,
  };
}

interface CartItemEditDialogProps {
  item: CartItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartItemEditDialog({
  item,
  open,
  onOpenChange,
}: CartItemEditDialogProps) {
  const updateCartItem = useCartStore((s) => s.updateCartItem);
  const cartItems = useCartStore((s) => s.items);
  const inventory = useDataStore((s) => s.inventory);
  const allProducts = useDataStore((s) => s.products);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>(
    {}
  );
  const [mixSlotProductIds, setMixSlotProductIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open || !item) {
      setProduct(null);
      return;
    }

    const initial = initStateFromCartItem(item);
    setSelectedOptions(initial.selectedOptions);
    setSelectedAddons(initial.selectedAddons);
    setMixSlotProductIds(initial.mixSlotProductIds);
    setQuantity(initial.quantity);

    setLoading(true);
    getProductById(item.productId).then((p) => {
      setProduct(p);
      if (p?.options) {
        setSelectedOptions((prev) => {
          const next = { ...prev };
          p.options!.forEach((opt) => {
            if (next[opt.id]) return;
            const def =
              opt.values?.find((v) => v.is_default) ?? opt.values?.[0];
            if (def) next[opt.id] = def.id;
          });
          return next;
        });
      }
      setLoading(false);
    });
  }, [open, item]);

  const cartOptions: CartItemOption[] = useMemo(() => {
    if (!product?.options) return [];
    return product.options
      .map((opt) => {
        const valueId = selectedOptions[opt.id];
        const val = opt.values?.find((v) => v.id === valueId);
        if (!val) return null;
        return {
          optionId: opt.id,
          optionName: opt.display_name,
          valueId: val.id,
          valueName: val.name,
          priceAdjustment: val.price_adjustment,
        };
      })
      .filter(Boolean) as CartItemOption[];
  }, [product, selectedOptions]);

  const cartAddons: CartItemAddon[] = useMemo(() => {
    if (!product?.addons) return [];
    return Object.entries(selectedAddons)
      .filter(([, qty]) => qty > 0)
      .map(([addonId, qty]) => {
        const addon = product.addons!.find((a) => a.id === addonId)!;
        return {
          addonId: addon.id,
          name: addon.name,
          price: addon.price,
          quantity: qty,
        };
      });
  }, [product, selectedAddons]);

  const mixPickerOptions = useMemo(() => {
    if (!product?.allows_mix_match) return [];
    return resolveMixPickerOptions(product, allProducts);
  }, [product, allProducts]);

  const additionalMixCount = Math.max(0, (product?.mix_max_flavors ?? 2) - 1);

  const mixComponents: CartItemMixComponent[] = useMemo(() => {
    if (!product?.allows_mix_match || mixSlotProductIds.length === 0) {
      return [];
    }
    const base: CartItemMixComponent = {
      productId: product.id,
      name: product.name,
    };
    const extras = mixSlotProductIds
      .filter(Boolean)
      .map((id) => {
        const flavor = mixPickerOptions.find((p) => p.id === id);
        return flavor
          ? { productId: flavor.id, name: flavor.name }
          : null;
      })
      .filter((m): m is CartItemMixComponent => m != null);
    return [base, ...extras];
  }, [product, mixSlotProductIds, mixPickerOptions]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const optionsTotal = cartOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    const addonsTotal = cartAddons.reduce((s, a) => s + a.price * a.quantity, 0);
    return product.base_price + optionsTotal + addonsTotal;
  }, [product, cartOptions, cartAddons]);

  const totalPrice = unitPrice * quantity;
  const orderable = product ? isProductOrderable(product, inventory) : false;

  const maxQuantity = useMemo(() => {
    if (!product || !item) return 0;
    return getMaxQuantityForCartLine(product, inventory, cartItems, item.id);
  }, [product, inventory, cartItems, item]);

  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [maxQuantity, quantity]);

  const toggleAddon = (addon: ProductAddon, checked: boolean) => {
    setSelectedAddons((prev) => {
      const next = { ...prev };
      if (checked) next[addon.id] = 1;
      else delete next[addon.id];
      return next;
    });
  };

  const toggleMixFlavor = (flavorId: string, checked: boolean) => {
    if (!product) return;
    const maxAdditional = Math.max(0, (product.mix_max_flavors ?? 2) - 1);
    setMixSlotProductIds((prev) => {
      if (checked) {
        if (prev.includes(flavorId)) return prev;
        if (prev.length >= maxAdditional) {
          toast.error(
            maxAdditional === 1
              ? `You can only pick 1 more flavor to mix with ${product.name}.`
              : `You can only pick ${maxAdditional} more flavors to mix with ${product.name}.`
          );
          return prev;
        }
        return [...prev, flavorId];
      }
      return prev.filter((id) => id !== flavorId);
    });
  };

  const handleIncreaseQuantity = () => {
    if (!product) return;
    if (quantity >= maxQuantity) {
      toast.error(maxStockToastMessage(product.name));
      return;
    }
    setQuantity((q) => q + 1);
  };

  const handleSave = () => {
    if (!product || !item || !orderable) return;

    const saved = updateCartItem(
      item.id,
      {
        productId: product.id,
        productName: product.name,
        productImage: product.image_url ?? null,
        basePrice: product.base_price,
        quantity,
        options: cartOptions.map((o) => ({
          ...o,
          priceAdjustment: o.priceAdjustment ?? 0,
        })),
        addons: cartAddons.map((a) => ({
          ...a,
          price: a.price ?? 0,
          quantity: a.quantity ?? 1,
        })),
        mixComponents: mixComponents.length > 0 ? mixComponents : undefined,
        specialInstructions: item.specialInstructions,
      },
      product
    );

    if (!saved) return;
    toast.success("Cart updated");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent scrollable className="sm:max-w-md">
        <DialogStickyHeader>
          <DialogTitle className="text-navy">
            {item ? `Edit ${item.productName}` : "Edit item"}
          </DialogTitle>
        </DialogStickyHeader>

        <DialogScrollBody className="space-y-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : !product ? (
            <p className="text-sm text-muted-foreground">
              This item is no longer available.
            </p>
          ) : (
            <>
              {product.allows_mix_match && mixPickerOptions.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-navy">
                    Mix flavors{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {additionalMixCount === 1
                      ? `Add up to 1 flavor to mix with ${product.name}, or skip for a single flavor`
                      : `Add up to ${additionalMixCount} flavors to mix with ${product.name}, or skip for a single flavor`}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl bg-muted/50 p-3">
                    {mixPickerOptions.map((flavor) => {
                      const checked = mixSlotProductIds.includes(flavor.id);
                      const maxReached =
                        mixSlotProductIds.length >= additionalMixCount &&
                        !checked;
                      return (
                        <div key={flavor.id} className="flex items-start gap-2.5">
                          <Checkbox
                            id={`edit-mix-${flavor.id}`}
                            checked={checked}
                            disabled={maxReached}
                            onCheckedChange={(v) =>
                              toggleMixFlavor(flavor.id, v === true)
                            }
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`edit-mix-${flavor.id}`}
                            className={cn(
                              "cursor-pointer text-sm font-medium leading-snug text-navy",
                              maxReached && "cursor-not-allowed opacity-50"
                            )}
                          >
                            {flavor.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {mixSlotProductIds.length === 0
                      ? `No mix — ordering ${product.name} only`
                      : `${mixSlotProductIds.length} / ${additionalMixCount} mix flavor${additionalMixCount === 1 ? "" : "s"} · includes ${product.name}`}
                  </p>
                </div>
              ) : null}

              {product.options?.map((opt) => (
                <OptionSelector
                  key={opt.id}
                  option={opt}
                  selectedValueId={selectedOptions[opt.id] ?? ""}
                  onSelect={(valueId) =>
                    setSelectedOptions((prev) => ({ ...prev, [opt.id]: valueId }))
                  }
                />
              ))}

              {product.addons && product.addons.length > 0 ? (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-navy">Sinkers</h3>
                  <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
                    {product.addons.map((addon) => (
                      <div key={addon.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`edit-addon-${addon.id}`}
                          checked={(selectedAddons[addon.id] ?? 0) > 0}
                          onCheckedChange={(checked) =>
                            toggleAddon(addon, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`edit-addon-${addon.id}`}
                          className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                        >
                          <span className="font-medium text-navy">{addon.name}</span>
                          <span className="text-green">
                            +{formatCurrency(addon.price)}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-navy">Quantity</h3>
                <div className="inline-flex items-center gap-4 rounded-2xl bg-muted/50 px-4 py-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy transition hover:bg-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[2rem] text-center text-lg font-bold text-navy">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={handleIncreaseQuantity}
                    disabled={maxQuantity <= 0 || quantity >= maxQuantity}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-semibold text-navy">
                Total: {formatCurrency(totalPrice)}
              </p>
            </>
          )}
        </DialogScrollBody>

        <DialogStickyFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !product || !orderable}
            className="bg-green hover:bg-green/90"
          >
            Save changes
          </Button>
        </DialogStickyFooter>
      </DialogContent>
    </Dialog>
  );
}
