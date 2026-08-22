"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { getProductBySlug } from "@/services/productService";
import { isProductOrderable } from "@/lib/inventory/availability";
import {
  getRemainingPurchasable,
  maxStockToastMessage,
} from "@/lib/cart/stockLimits";
import { useCartStore } from "@/stores/cart";
import { useDataStore } from "@/stores/data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type {
  CartItemAddon,
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
                : "bg-white text-navy shadow-card hover:bg-muted",
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const inventory = useDataStore((s) => s.inventory);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

  useEffect(() => {
    getProductBySlug(slug).then((p) => {
      setProduct(p);
      if (p?.options) {
        const defaults: Record<string, string> = {};
        p.options.forEach((opt) => {
          const def =
            opt.values?.find((v) => v.is_default) ?? opt.values?.[0];
          if (def) defaults[opt.id] = def.id;
        });
        setSelectedOptions(defaults);
      }
      setLoading(false);
    });
  }, [slug]);

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

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const optionsTotal = cartOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    const addonsTotal = cartAddons.reduce((s, a) => s + a.price * a.quantity, 0);
    return product.base_price + optionsTotal + addonsTotal;
  }, [product, cartOptions, cartAddons]);

  const totalPrice = unitPrice * quantity;
  const orderable = product
    ? isProductOrderable(product, inventory)
    : false;
  const remainingPurchasable = product
    ? getRemainingPurchasable(product, inventory, cartItems)
    : 0;

  useEffect(() => {
    if (remainingPurchasable > 0 && quantity > remainingPurchasable) {
      setQuantity(remainingPurchasable);
    }
  }, [remainingPurchasable, quantity]);

  const handleIncreaseQuantity = () => {
    if (!product) return;
    if (quantity >= remainingPurchasable) {
      toast.error(maxStockToastMessage(product.name));
      return;
    }
    setQuantity((q) => q + 1);
  };

  const toggleAddon = (addon: ProductAddon, checked: boolean) => {
    setSelectedAddons((prev) => {
      const next = { ...prev };
      if (checked) next[addon.id] = 1;
      else delete next[addon.id];
      return next;
    });
  };

  const handleAddToCart = () => {
    if (!product || !orderable) return;
    const added = addItem(
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
      },
      product
    );
    if (!added) return;
    toast.success(`${product.name} added to cart`);
    router.push("/cart");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-28">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-navy">Product not found</h1>
        <Button
          onClick={() => router.push("/menu")}
          className="mt-4 bg-green hover:bg-green/90"
        >
          Back to Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-36 sm:pb-32">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-light-blue shadow-card">
        {product.image_url && (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 512px"
            priority
          />
        )}
      </div>

      <div className="mt-5 space-y-1">
        <h1 className="text-2xl font-bold text-navy">{product.name}</h1>
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <p className="text-xl font-bold text-green">
            {formatCurrency(product.base_price)}
          </p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-medium text-navy">{product.rating.toFixed(1)}</span>
            <span>({product.review_count})</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
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

        {product.addons && product.addons.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-navy">Add-ons</h3>
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
              {product.addons.map((addon) => (
                <div key={addon.id} className="flex items-center gap-3">
                  <Checkbox
                    id={addon.id}
                    checked={(selectedAddons[addon.id] ?? 0) > 0}
                    onCheckedChange={(checked) =>
                      toggleAddon(addon, checked === true)
                    }
                  />
                  <Label
                    htmlFor={addon.id}
                    className="flex flex-1 cursor-pointer items-center justify-between text-sm"
                  >
                    <span className="font-medium text-navy">{addon.name}</span>
                    <span className="text-green">+{formatCurrency(addon.price)}</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy">Quantity</h3>
          <div className="inline-flex items-center gap-4 rounded-2xl bg-white px-4 py-2 shadow-card">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-navy transition hover:bg-muted/80"
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
              disabled={remainingPurchasable <= 0 || quantity >= remainingPurchasable}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-navy transition hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t border-border bg-white/95 px-3 py-3 backdrop-blur-md safe-bottom sm:px-4 lg:bottom-0">
        <Button
          onClick={handleAddToCart}
          disabled={!orderable}
          className="mx-auto flex h-12 w-full max-w-lg rounded-xl bg-green text-sm font-bold hover:bg-green/90 sm:text-base"
        >
          {orderable
            ? `ADD TO CART — ${formatCurrency(totalPrice)}`
            : "UNAVAILABLE"}
        </Button>
      </div>
    </div>
  );
}
