"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import {
  removeProductRemote,
  syncProduct,
  uploadProductImage,
} from "@/services/catalogService";
import { applyInventoryAvailabilityRules } from "@/services/inventoryService";
import {
  getProductStockStatus,
  type ProductStockStatus,
} from "@/lib/inventory/availability";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
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
import type { Product } from "@/types";

type RecipeDraft = {
  inventoryItemId: string;
  quantityRequired: string;
};

function emptyRecipe(): RecipeDraft {
  return { inventoryItemId: "", quantityRequired: "" };
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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
  const [recipes, setRecipes] = useState<RecipeDraft[]>([emptyRecipe()]);

  const activeCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  const stockByProductId = useMemo(() => {
    const map = new Map<string, ProductStockStatus>();
    for (const product of products) {
      map.set(product.id, getProductStockStatus(product, inventory));
    }
    return map;
  }, [products, inventory]);

  useEffect(() => {
    void applyInventoryAvailabilityRules();
  }, [inventory, products.length]);

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
    setRecipes([emptyRecipe()]);
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
    setRecipes(
      product.recipes && product.recipes.length > 0
        ? product.recipes.map((r) => ({
            inventoryItemId: r.inventory_item_id,
            quantityRequired: String(r.quantity_required),
          }))
        : [emptyRecipe()]
    );
    setDialogOpen(true);
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

  const handleSave = async () => {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    const parsedRecipes = parseRecipes();
    if (!parsedRecipes) return;

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
          description: description.trim() || null,
          base_price: parsedPrice,
          category_id: categoryId,
          is_featured: isFeatured,
          is_best_seller: isBestSeller,
          ...(nextImageUrl ? { image_url: nextImageUrl } : {}),
        });
        setProductRecipes(editProduct.id, parsedRecipes);

        const latest = useDataStore
          .getState()
          .products.find((p) => p.id === editProduct.id);
        if (latest && isUuid(latest.id) && isUuid(latest.category_id)) {
          const sync = await syncProduct(latest);
          if (!sync.ok) toast.error(sync.error ?? "Saved locally only.");
        }

        toast.success(`"${trimmedName}" updated.`);
        await applyInventoryAvailabilityRules();
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

      if (imageFile) {
        const uploaded = await uploadProductImage(imageFile, created.id);
        if ("error" in uploaded) {
          toast.error(uploaded.error);
        } else {
          updateProduct(created.id, { image_url: uploaded.publicUrl });
        }
      }

      const latest = useDataStore
        .getState()
        .products.find((p) => p.id === created.id);
      if (latest && isUuid(latest.id) && isUuid(latest.category_id)) {
        const sync = await syncProduct(latest);
        if (!sync.ok) toast.error(sync.error ?? "Saved locally only.");
      }

      toast.success(`"${trimmedName}" added with ingredients.`);
      await applyInventoryAvailabilityRules();
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Product" : "Add Product"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
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
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => v && setCategoryId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-light-blue">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
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
                    key={index}
                    className="grid gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-[1fr_100px_auto]"
                  >
                    <Select
                      value={row.inventoryItemId}
                      onValueChange={(v) =>
                        v && updateRecipe(index, { inventoryItemId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Inventory item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Qty"
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
                      className="text-destructive"
                      disabled={recipes.length <= 1}
                      onClick={() =>
                        setRecipes((rows) =>
                          rows.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {row.inventoryItemId && (
                      <p className="text-[11px] text-muted-foreground sm:col-span-3">
                        Per drink: {row.quantityRequired || "0"}{" "}
                        {getInventoryUnit(row.inventoryItemId)} of{" "}
                        {getInventoryName(row.inventoryItemId)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : isEditMode
                    ? "Save Changes"
                    : "Save Product"}
              </Button>
            </div>
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
                      <h3 className="font-semibold text-navy">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {getCategoryName(product.category_id)}
                      </p>
                    </div>
                    <p className="font-semibold text-green">
                      {formatCurrency(product.base_price)}
                    </p>
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
