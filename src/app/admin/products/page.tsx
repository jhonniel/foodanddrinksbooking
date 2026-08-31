"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { pauseCatalogSync } from "@/lib/catalog/syncPause";
import { breakdownRecipeCostForOneUnit } from "@/lib/inventory/cost";
import {
  removeProductRemote,
  syncProduct,
  uploadProductImage,
} from "@/services/catalogService";
import {
  getProductStockStatus,
  type ProductStockStatus,
} from "@/lib/inventory/availability";
import { formatCurrency, slugify } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { CategoryLabel } from "@/components/shared/CategoryLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/select";
import type { Product } from "@/types";
import { mergeSinkersForProduct } from "@/lib/catalog/sinkers";

type RecipeDraft = {
  rowId: string;
  inventoryItemId: string;
  quantityRequired: string;
};

type SinkerDraft = {
  id: string;
  name: string;
  price: string;
  isAvailable: boolean;
};

function emptyRecipe(): RecipeDraft {
  return {
    inventoryItemId: "",
    quantityRequired: "",
    rowId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `recipe-row-${Date.now()}`,
  };
}

function emptySinker(): SinkerDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sinker-${Date.now()}`,
    name: "",
    price: "",
    isAvailable: true,
  };
}

function dedupeRecipeDrafts(rows: RecipeDraft[]): RecipeDraft[] {
  const byInventory = new Map<string, RecipeDraft>();
  for (const row of rows) {
    if (!row.inventoryItemId) {
      byInventory.set(`__empty-${row.rowId}`, row);
      continue;
    }
    byInventory.set(row.inventoryItemId, row);
  }
  return Array.from(byInventory.values());
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export default function AdminProductsPage() {
  const products = useDataStore((s) => s.products);
  const categories = useDataStore((s) => s.categories);
  const inventory = useDataStore((s) => s.inventory);
  const addProduct = useDataStore((s) => s.addProduct);
  const updateProduct = useDataStore((s) => s.updateProduct);
  const deleteProduct = useDataStore((s) => s.deleteProduct);
  const toggleProductAvailability = useDataStore(
    (s) => s.toggleProductAvailability
  );
  const setProductRecipes = useDataStore((s) => s.setProductRecipes);
  const setProductAddons = useDataStore((s) => s.setProductAddons);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [allowsMixMatch, setAllowsMixMatch] = useState(false);
  const [mixMaxFlavors, setMixMaxFlavors] = useState(2);
  const [mixCandidateIds, setMixCandidateIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<RecipeDraft[]>([emptyRecipe()]);
  const [sinkers, setSinkers] = useState<SinkerDraft[]>([]);

  const activeCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
          const catA = categoryNameById.get(a.category_id) ?? "Unknown";
          const catB = categoryNameById.get(b.category_id) ?? "Unknown";
          const byCategory = catA.localeCompare(catB, undefined, {
            sensitivity: "base",
          });
          if (byCategory !== 0) return byCategory;
          return a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
        }),
    [products, search, categoryNameById]
  );

  const stockByProductId = useMemo(() => {
    const map = new Map<string, ProductStockStatus>();
    for (const product of products) {
      map.set(product.id, getProductStockStatus(product, inventory));
    }
    return map;
  }, [products, inventory]);

  const categorySinkersPreview = useMemo(() => {
    if (!categoryId) return [];
    return (
      categories.find((c) => c.id === categoryId)?.sinkers?.filter(
        (s) => s.is_available
      ) ?? []
    );
  }, [categories, categoryId]);

  const mixablePeerProducts = useMemo(() => {
    if (!categoryId) return [];
    return products
      .filter(
        (p) =>
          p.category_id === categoryId &&
          p.id !== editProduct?.id &&
          p.is_available
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, categoryId, editProduct?.id]);

  const categoryMixEnabled = useMemo(
    () =>
      Boolean(
        categories.find((c) => c.id === categoryId)?.allows_mix_match
      ),
    [categories, categoryId]
  );

  const draftRecipeCost = useMemo(() => {
    const parsed = recipes
      .map((r) => ({
        inventory_item_id: r.inventoryItemId,
        quantity_required: parseFloat(r.quantityRequired),
      }))
      .filter(
        (r) =>
          r.inventory_item_id &&
          Number.isFinite(r.quantity_required) &&
          r.quantity_required > 0
      );
    return breakdownRecipeCostForOneUnit(parsed, inventory);
  }, [recipes, inventory]);

  const parsedPriceForMargin = parseFloat(price);
  const hasValidPrice =
    price.trim() !== "" &&
    Number.isFinite(parsedPriceForMargin) &&
    parsedPriceForMargin > 0;
  const draftMargin =
    hasValidPrice && draftRecipeCost.total > 0
      ? parsedPriceForMargin - draftRecipeCost.total
      : null;
  const draftMarginPct =
    draftMargin != null && parsedPriceForMargin > 0
      ? (draftMargin / parsedPriceForMargin) * 100
      : null;

  useEffect(() => {
    if (!dialogOpen) return;
    return pauseCatalogSync();
  }, [dialogOpen]);

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Unknown";

  const getInventoryName = (id: string) =>
    inventory.find((i) => i.id === id)?.name ?? "Unknown";

  const getInventoryUnit = (id: string) =>
    inventory.find((i) => i.id === id)?.unit ?? "";

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId(activeCategories[0]?.id ?? "");
    setImageUrl("");
    setImageFile(null);
    setIsFeatured(false);
    setIsBestSeller(false);
    setAllowsMixMatch(false);
    setMixMaxFlavors(2);
    setMixCandidateIds([]);
    setRecipes([emptyRecipe()]);
    setSinkers([]);
    setEditProduct(null);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open && !categoryId && activeCategories[0]) {
      setCategoryId(activeCategories[0].id);
    }
    if (!open) resetForm();
  };

  const openEditProduct = (product: Product) => {
    setEditProduct(product);
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(String(product.base_price));
    setCategoryId(product.category_id);
    setImageUrl(product.image_url ?? "");
    setImageFile(null);
    setIsFeatured(product.is_featured);
    setIsBestSeller(product.is_best_seller);
    setAllowsMixMatch(Boolean(product.allows_mix_match));
    setMixMaxFlavors(product.mix_max_flavors ?? 2);
    setMixCandidateIds(product.mix_candidate_ids ?? []);
    setRecipes(
      product.recipes && product.recipes.length > 0
        ? dedupeRecipeDrafts(
            product.recipes.map((r) => ({
              rowId: r.id,
              inventoryItemId: r.inventory_item_id,
              quantityRequired: String(r.quantity_required),
            }))
          )
        : [emptyRecipe()]
    );
    setSinkers(
      (product.addons ?? [])
        .filter((a) => !a.is_global)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a) => ({
          id: a.id,
          name: a.name,
          price: String(a.price),
          isAvailable: a.is_available,
        }))
    );
    setDialogOpen(true);
  };

  const updateSinker = (index: number, patch: Partial<SinkerDraft>) => {
    setSinkers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const parseSinkers = () => {
    const parsed = sinkers
      .map((s) => ({
        id: s.id,
        name: s.name.trim(),
        price: parseFloat(s.price),
        isAvailable: s.isAvailable,
      }))
      .filter((s) => s.name && !isNaN(s.price) && s.price >= 0);

    const names = parsed.map((s) => s.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error("Each sinker name must be unique for this drink.");
      return null;
    }
    return parsed;
  };

  const updateRecipe = (index: number, patch: Partial<RecipeDraft>) => {
    setRecipes((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const parseRecipes = () => {
    const parsed = recipes
      .map((r) => ({
        inventoryItemId: r.inventoryItemId,
        quantityRequired: parseFloat(r.quantityRequired),
      }))
      .filter(
        (r) =>
          r.inventoryItemId &&
          !isNaN(r.quantityRequired) &&
          r.quantityRequired > 0
      );

    const ids = parsed.map((r) => r.inventoryItemId);
    if (new Set(ids).size !== ids.length) {
      toast.error("Each inventory item can only be used once per product.");
      return null;
    }
    return parsed;
  };

  const applyLocalAvailability = (productId: string) => {
    const { products: allProducts, inventory: inv } = useDataStore.getState();
    const product = allProducts.find((p) => p.id === productId);
    if (!product?.is_available) return;

    const status = getProductStockStatus(product, inv);
    const shouldBeUnavailable =
      status.level === "no_recipe" || (status.makeable ?? 0) <= 0;
    if (shouldBeUnavailable) {
      updateProduct(productId, { is_available: false });
    }
  };

  const persistProductToServer = async (
    productId: string,
    successMessage: string
  ): Promise<boolean> => {
    applyLocalAvailability(productId);

    const latest = useDataStore
      .getState()
      .products.find((p) => p.id === productId);
    if (!latest) {
      toast.error("Product not found after save.");
      return false;
    }

    if (!isUuid(latest.id)) {
      toast.success(`${successMessage} (saved locally only)`);
      return true;
    }

    if (!isUuid(latest.category_id)) {
      toast.error(
        "Could not save to the server — select a category synced to Supabase."
      );
      return false;
    }

    const sync = await syncProduct(latest);
    if (!sync.ok) {
      toast.error(
        sync.error ??
          "Could not save product to the server. Check ingredients and try again."
      );
      return false;
    }

    const { requestServerDataSync } = await import(
      "@/services/dataSyncService"
    );
    requestServerDataSync();
    toast.success(successMessage);
    return true;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    const parsedRecipes = parseRecipes();
    const parsedSinkers = parseSinkers();
    if (!parsedRecipes || parsedSinkers === null) return;

    if (!trimmedName) {
      toast.error("Product name is required.");
      return;
    }
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error("Enter a valid price greater than zero.");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }
    if (parsedRecipes.length === 0) {
      toast.error("Add at least one ingredient so stock can be deducted.");
      return;
    }
    if (allowsMixMatch && mixCandidateIds.length === 0) {
      toast.error(
        "Select at least one other flavor customers can mix with this product."
      );
      return;
    }

    setSaving(true);
    try {
      let nextImageUrl = imageUrl.trim() || undefined;

      if (editProduct) {
        if (imageFile) {
          const uploaded = await uploadProductImage(imageFile, editProduct.id);
          if ("error" in uploaded) {
            toast.error(uploaded.error);
            return;
          }
          nextImageUrl = uploaded.publicUrl;
        }

        updateProduct(editProduct.id, {
          name: trimmedName,
          slug: slugify(trimmedName),
          description: description.trim() || null,
          base_price: parsedPrice,
          category_id: categoryId,
          is_featured: isFeatured,
          is_best_seller: isBestSeller,
          allows_mix_match: allowsMixMatch,
          mix_max_flavors: mixMaxFlavors,
          mix_candidate_ids: allowsMixMatch ? mixCandidateIds : [],
          ...(nextImageUrl ? { image_url: nextImageUrl } : {}),
        });
        setProductRecipes(editProduct.id, parsedRecipes);
        setProductAddons(editProduct.id, parsedSinkers);

        const ok = await persistProductToServer(
          editProduct.id,
          `"${trimmedName}" updated.`
        );
        if (!ok) return;

        setDialogOpen(false);
        resetForm();
        return;
      }

      const created = addProduct({
        name: trimmedName,
        description: description.trim() || undefined,
        categoryId,
        basePrice: parsedPrice,
        imageUrl: nextImageUrl,
        isFeatured,
        isBestSeller,
        recipes: parsedRecipes,
      });

      if (parsedSinkers.length > 0) {
        setProductAddons(created.id, parsedSinkers);
      }

      updateProduct(created.id, {
        allows_mix_match: allowsMixMatch,
        mix_max_flavors: mixMaxFlavors,
        mix_candidate_ids: allowsMixMatch ? mixCandidateIds : [],
      });

      if (imageFile) {
        const uploaded = await uploadProductImage(imageFile, created.id);
        if ("error" in uploaded) {
          toast.error(uploaded.error);
          return;
        }
        updateProduct(created.id, { image_url: uploaded.publicUrl });
      }

      const ok = await persistProductToServer(
        created.id,
        `"${trimmedName}" added with ingredients.`
      );
      if (!ok) return;

      setDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (id: string, productName: string) => {
    const product = useDataStore.getState().products.find((p) => p.id === id);
    if (!product) return;

    const turningOn = !product.is_available;
    if (turningOn) {
      const status = getProductStockStatus(product, inventory);
      if (status.level === "no_recipe") {
        toast.error(
          `Cannot enable "${productName}" — add a recipe (ingredients) first.`
        );
        return;
      }
      if ((status.makeable ?? 0) <= 0) {
        const blockers =
          status.blockingIngredientNames.length > 0
            ? status.blockingIngredientNames.join(", ")
            : "ingredients";
        toast.error(
          `Cannot enable "${productName}" — out of stock (${blockers}). Restock inventory first.`
        );
        return;
      }
    }

    toggleProductAvailability(id);
    const updated = useDataStore.getState().products.find((p) => p.id === id);
    const nowAvailable = updated?.is_available ?? true;
    toast.success(
      `"${productName}" is now ${nowAvailable ? "available" : "unavailable"}.`
    );
    if (updated && isUuid(updated.id)) {
      void syncProduct(updated);
    }
  };

  const handleDelete = async (id: string, productName: string) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone.`))
      return;

    if (isUuid(id)) {
      const remote = await removeProductRemote(id);
      if (!remote.ok) {
        toast.error(remote.error ?? "Could not delete product.");
        return;
      }
    }

    deleteProduct(id);
    const { requestServerDataSync } = await import(
      "@/services/dataSyncService"
    );
    requestServerDataSync();
    toast.success(`"${productName}" removed from the menu.`);
  };

  const isEditMode = Boolean(editProduct);
  const previewUrl = imageFile
    ? URL.createObjectURL(imageFile)
    : imageUrl || null;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage menu items, ingredients, and availability
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
            onClick={() => {
              setEditProduct(null);
              resetForm();
            }}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </DialogTrigger>
          <DialogContent scrollable className="sm:max-w-lg">
            <DialogStickyHeader>
              <DialogTitle>
                {isEditMode ? "Edit Product" : "Add Product"}
              </DialogTitle>
            </DialogStickyHeader>
            <DialogScrollBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Berry Soda"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Fresh and fruity island cooler"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="price">Price (₱) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="85"
                />
                <div className="mt-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">
                      Estimated cost (ingredients)
                    </span>
                    <span className="font-semibold text-navy">
                      {draftRecipeCost.lines.length > 0
                        ? formatCurrency(draftRecipeCost.total)
                        : "—"}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / drink
                      </span>
                    </span>
                  </div>
                  {draftMargin != null && draftRecipeCost.total > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Margin:{" "}
                      <span
                        className={
                          draftMargin >= 0
                            ? "font-medium text-green"
                            : "font-medium text-red-600"
                        }
                      >
                        {formatCurrency(draftMargin)}
                      </span>
                      {draftMarginPct != null ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({draftMarginPct.toFixed(0)}% of price)
                        </span>
                      ) : null}
                    </p>
                  ) : draftRecipeCost.lines.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add ingredients below to calculate cost from inventory
                      prices.
                    </p>
                  ) : null}
                  {draftRecipeCost.lines.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      {draftRecipeCost.lines.map((line) => (
                        <li
                          key={line.inventoryItemId}
                          className="flex justify-between gap-2"
                        >
                          <span>
                            {line.name} · {line.quantity} {line.unit} ×{" "}
                            {formatCurrency(line.unitCost)}
                          </span>
                          <span className="shrink-0 tabular-nums text-navy">
                            {formatCurrency(line.lineCost)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => v && setCategoryId(v)}
                >
                  <SelectTrigger className="w-full max-w-full">
                    <span className="truncate">
                      {categoryId
                        ? getCategoryName(categoryId)
                        : "Select category"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product image</Label>
                {previewUrl && (
                  <div className="relative max-h-36 overflow-hidden rounded-xl bg-light-blue">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full max-h-36 w-full object-cover"
                    />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setImageFile(file);
                  }}
                />
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste image URL"
                />
                <p className="text-xs text-muted-foreground">
                  Uploads save to S3 (`islandcoolersimg`).
                </p>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="featured"
                    checked={isFeatured}
                    onCheckedChange={(v) => setIsFeatured(v === true)}
                  />
                  <Label htmlFor="featured" className="cursor-pointer">
                    Featured
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="best-seller"
                    checked={isBestSeller}
                    onCheckedChange={(v) => setIsBestSeller(v === true)}
                  />
                  <Label htmlFor="best-seller" className="cursor-pointer">
                    Best Seller
                  </Label>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-sky/20 bg-sky/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Mix &amp; Match
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Let customers combine this flavor with others in one drink
                    </p>
                  </div>
                  <Switch
                    checked={allowsMixMatch}
                    onCheckedChange={setAllowsMixMatch}
                  />
                </div>

                {categoryMixEnabled && !allowsMixMatch ? (
                  <p className="text-xs text-sky">
                    This category already has Mix &amp; Match enabled — all
                    drinks inherit it. Turn this on to override per product.
                  </p>
                ) : null}

                {allowsMixMatch ? (
                  <div className="space-y-3 border-t border-sky/10 pt-3">
                    <div>
                      <Label>Flavor slots per drink</Label>
                      <Select
                        value={String(mixMaxFlavors)}
                        onValueChange={(v) => v && setMixMaxFlavors(Number(v))}
                      >
                        <SelectTrigger className="mt-1 w-full max-w-[10rem]">
                          <span>{mixMaxFlavors} flavors</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 flavors</SelectItem>
                          <SelectItem value="3">3 flavors</SelectItem>
                          <SelectItem value="4">4 flavors</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">
                        Mixable flavors (same category)
                      </Label>
                      {mixablePeerProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add other products in this category first, then select
                          which flavors can be mixed.
                        </p>
                      ) : (
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-white p-2">
                          {mixablePeerProducts.map((peer) => (
                            <div
                              key={peer.id}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`mix-${peer.id}`}
                                checked={mixCandidateIds.includes(peer.id)}
                                onCheckedChange={(checked) => {
                                  setMixCandidateIds((prev) =>
                                    checked === true
                                      ? [...prev, peer.id]
                                      : prev.filter((id) => id !== peer.id)
                                  );
                                }}
                              />
                              <Label
                                htmlFor={`mix-${peer.id}`}
                                className="cursor-pointer text-sm font-normal"
                              >
                                {peer.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Ingredients *
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stock deducted automatically when an order is delivered
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRecipes((r) => [...r, emptyRecipe()])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {recipes.map((row, index) => (
                  <div
                    key={row.rowId}
                    className="space-y-2 rounded-lg bg-muted/40 p-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={row.inventoryItemId}
                      onValueChange={(v) =>
                        v && updateRecipe(index, { inventoryItemId: v })
                      }
                    >
                      <SelectTrigger className="w-full min-w-0 flex-1 max-w-full sm:flex-1">
                        <span className="truncate">
                          {row.inventoryItemId
                            ? `${getInventoryName(row.inventoryItemId)} (${getInventoryUnit(row.inventoryItemId)})`
                            : "Inventory item"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 sm:shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Qty"
                      className="w-full sm:w-24"
                      value={row.quantityRequired}
                      onChange={(e) =>
                        updateRecipe(index, {
                          quantityRequired: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-destructive"
                      disabled={recipes.length <= 1}
                      onClick={() =>
                        setRecipes((rows) =>
                          rows.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    </div>
                    </div>
                    {row.inventoryItemId && (
                      <p className="text-[11px] text-muted-foreground">
                        Per drink: {row.quantityRequired || "0"}{" "}
                        {getInventoryUnit(row.inventoryItemId)} of{" "}
                        {getInventoryName(row.inventoryItemId)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy">Sinkers</p>
                    <p className="text-xs text-muted-foreground">
                      Optional add-ons for this drink only. Drinks also inherit
                      sinkers from their category (set under Admin → Categories).
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSinkers((rows) => [...rows, emptySinker()])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {sinkers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No drink-specific sinkers yet. Add pearls, jelly, or other
                    toppings.
                  </p>
                ) : (
                  sinkers.map((row, index) => (
                    <div
                      key={row.id}
                      className="space-y-2 rounded-lg bg-muted/40 p-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          placeholder="Sinker name (e.g. Classic Pearls)"
                          value={row.name}
                          onChange={(e) =>
                            updateSinker(index, { name: e.target.value })
                          }
                          className="sm:flex-1"
                        />
                        <div className="flex gap-2 sm:shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price ₱"
                            className="w-full sm:w-28"
                            value={row.price}
                            onChange={(e) =>
                              updateSinker(index, { price: e.target.value })
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-destructive"
                            onClick={() =>
                              setSinkers((rows) =>
                                rows.filter((_, i) => i !== index)
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`sinker-available-${row.id}`}
                          checked={row.isAvailable}
                          onCheckedChange={(v) =>
                            updateSinker(index, { isAvailable: v === true })
                          }
                        />
                        <Label
                          htmlFor={`sinker-available-${row.id}`}
                          className="cursor-pointer text-xs text-muted-foreground"
                        >
                          Available to customers
                        </Label>
                      </div>
                    </div>
                  ))
                )}

                {categorySinkersPreview.length > 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2.5">
                    <p className="text-xs font-medium text-navy">
                      From category ({getCategoryName(categoryId)})
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      {categorySinkersPreview.map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <span>{s.name}</span>
                          <span>{formatCurrency(s.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            </DialogScrollBody>
            <DialogStickyFooter>
              <Button
                className="w-full bg-green hover:bg-green/90 sm:w-auto sm:min-w-[140px]"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : isEditMode
                    ? "Save Changes"
                    : "Save Product"}
              </Button>
            </DialogStickyFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <p className="text-muted-foreground">No products found.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const stock =
              stockByProductId.get(product.id) ??
              getProductStockStatus(product, inventory);
            const isNoRecipe = stock.level === "no_recipe";
            const isOut = stock.level === "out" || isNoRecipe;
            const isLow = stock.level === "low";
            const productCost = breakdownRecipeCostForOneUnit(
              product.recipes ?? [],
              inventory
            );
            const productMargin =
              productCost.total > 0
                ? product.base_price - productCost.total
                : null;

            return (
              <div
                key={product.id}
                className={cn(
                  "overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-transparent",
                  isOut && "bg-red-50/80 ring-red-300",
                  isLow && !isOut && "bg-amber-50/70 ring-amber-300"
                )}
              >
                <div className="relative aspect-square bg-light-blue">
                  {product.image_url && (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="25vw"
                    />
                  )}
                  {(isOut || isLow) && (
                    <div
                      className={cn(
                        "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
                        isOut ? "bg-red-600" : "bg-amber-500"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {isNoRecipe
                        ? "No recipe"
                        : isOut
                          ? "Out of stock"
                          : "Low stock"}
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CategoryLabel
                        name={getCategoryName(product.category_id)}
                        className="mb-1.5"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-navy">{product.name}</h3>
                        {(product.allows_mix_match ||
                          categories.find((c) => c.id === product.category_id)
                            ?.allows_mix_match) ? (
                          <Badge className="bg-sky/10 text-[10px] text-sky hover:bg-sky/10">
                            Mix
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green">
                        {formatCurrency(product.base_price)}
                      </p>
                      {productCost.total > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Cost {formatCurrency(productCost.total)}
                          {productMargin != null ? (
                            <span
                              className={
                                productMargin >= 0
                                  ? " text-green"
                                  : " text-red-600"
                              }
                            >
                              {" "}
                              · margin {formatCurrency(productMargin)}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                    <p className="text-xs font-medium text-navy">
                      {isNoRecipe
                        ? "No recipe set — unavailable"
                        : `Can make: ${stock.makeable ?? 0}`}
                    </p>
                    {stock.lowIngredientNames.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Low: {stock.lowIngredientNames.join(", ")}
                      </p>
                    )}
                    {stock.blockingIngredientNames.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-red-700">
                        Missing: {stock.blockingIngredientNames.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {product.is_featured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                    {product.is_best_seller && (
                      <Badge variant="secondary">Best seller</Badge>
                    )}
                    {(product.addons ?? []).filter((a) => !a.is_global).length >
                      0 ||
                    (
                      categories.find((c) => c.id === product.category_id)
                        ?.sinkers ?? []
                    ).length > 0 ? (
                      <Badge variant="outline">
                        {mergeSinkersForProduct(
                          categories.find((c) => c.id === product.category_id)
                            ?.sinkers ?? [],
                          (product.addons ?? []).filter((a) => !a.is_global)
                        ).length}{" "}
                        sinker
                        {mergeSinkersForProduct(
                          categories.find((c) => c.id === product.category_id)
                            ?.sinkers ?? [],
                          (product.addons ?? []).filter((a) => !a.is_global)
                        ).length === 1
                          ? ""
                          : "s"}
                      </Badge>
                    ) : null}
                    {!product.is_available && (
                      <Badge variant="destructive">Unavailable</Badge>
                    )}
                    {isLow && product.is_available && (
                      <Badge className="border-transparent bg-amber-100 text-amber-800">
                        Low ingredients
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_available}
                        onCheckedChange={() =>
                          void handleToggleAvailability(
                            product.id,
                            product.name
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        Available
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditProduct(product)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() =>
                          void handleDelete(product.id, product.name)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
