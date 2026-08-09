"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import { formatCurrency } from "@/lib/utils/format";
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

  const updateRecipe = (
    index: number,
    patch: Partial<RecipeDraft>
  ) => {
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

  const handleSave = () => {
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

    if (editProduct) {
      updateProduct(editProduct.id, {
        name: trimmedName,
        description: description.trim() || null,
        base_price: parsedPrice,
        category_id: categoryId,
        is_featured: isFeatured,
        is_best_seller: isBestSeller,
      });
      setProductRecipes(editProduct.id, parsedRecipes);
      toast.success(`"${trimmedName}" updated.`);
      setDialogOpen(false);
      resetForm();
      return;
    }

    addProduct({
      name: trimmedName,
      description: description.trim() || undefined,
      categoryId,
      basePrice: parsedPrice,
      isFeatured,
      isBestSeller,
      recipes: parsedRecipes,
    });

    toast.success(`"${trimmedName}" added with ingredients.`);
    setDialogOpen(false);
    resetForm();
  };

  const handleToggleAvailability = (id: string, productName: string) => {
    toggleProductAvailability(id);
    const product = products.find((p) => p.id === id);
    const nowAvailable = product ? !product.is_available : true;
    toast.success(
      `"${productName}" is now ${nowAvailable ? "available" : "unavailable"}.`
    );
  };

  const handleDelete = (id: string, productName: string) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone.`))
      return;
    deleteProduct(id);
    toast.success(`"${productName}" removed from the menu.`);
  };

  const isEditMode = Boolean(editProduct);

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
                onClick={handleSave}
              >
                {isEditMode ? "Save Changes" : "Save Product"}
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
          {filtered.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-2xl bg-white shadow-card"
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
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {product.is_featured && (
                    <Badge className="bg-sky text-white">Featured</Badge>
                  )}
                  {product.is_best_seller && (
                    <Badge className="bg-green text-white">Best Seller</Badge>
                  )}
                  {product.is_new && <Badge variant="secondary">New</Badge>}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-navy">{product.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {getCategoryName(product.category_id)} · {product.sku}
                </p>
                <p className="mt-1 text-lg font-bold text-green">
                  {formatCurrency(product.base_price)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(product.recipes?.length ?? 0) > 0
                    ? `${product.recipes!.length} ingredient${
                        product.recipes!.length === 1 ? "" : "s"
                      }`
                    : "No ingredients set"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <Label htmlFor={`avail-${product.id}`} className="text-sm">
                    Available
                  </Label>
                  <Switch
                    id={`avail-${product.id}`}
                    checked={product.is_available}
                    onCheckedChange={() =>
                      handleToggleAvailability(product.id, product.name)
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => openEditProduct(product)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full text-destructive hover:bg-red-50 hover:text-destructive"
                  onClick={() => handleDelete(product.id, product.name)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
