"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
import {
  syncCategory,
  uploadCategoryImage,
  removeCategoryRemote,
} from "@/services/catalogService";
import { Button } from "@/components/ui/button";
import { CategoryLabel } from "@/components/shared/CategoryLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogScrollBody,
  DialogStickyFooter,
  DialogStickyHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@/types";

type SinkerDraft = {
  id: string;
  name: string;
  price: string;
  isAvailable: boolean;
};

function emptySinker(): SinkerDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cat-sinker-${Date.now()}`,
    name: "",
    price: "",
    isAvailable: true,
  };
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

export default function AdminCategoriesPage() {
  const categories = useDataStore((s) => s.categories);
  const products = useDataStore((s) => s.products);
  const addCategory = useDataStore((s) => s.addCategory);
  const updateCategory = useDataStore((s) => s.updateCategory);
  const deleteCategory = useDataStore((s) => s.deleteCategory);
  const toggleCategoryActive = useDataStore((s) => s.toggleCategoryActive);
  const reorderCategories = useDataStore((s) => s.reorderCategories);
  const setCategorySinkers = useDataStore((s) => s.setCategorySinkers);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [sinkers, setSinkers] = useState<SinkerDraft[]>([]);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const resetForm = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setImageFile(null);
    setSinkers([]);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setImageUrl(category.image_url ?? "");
    setImageFile(null);
    setSinkers(
      (category.sinkers ?? [])
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
    for (const s of sinkers) {
      const hasName = s.name.trim().length > 0;
      const priceNum = parseFloat(s.price);
      const hasPrice = s.price.trim() !== "" && !isNaN(priceNum) && priceNum >= 0;
      if (hasName !== hasPrice) {
        toast.error("Each sinker needs both a name and a price (₱0 or more).");
        return null;
      }
    }

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
      toast.error("Each sinker name must be unique in this category.");
      return null;
    }
    return parsed;
  };

  const persistCategory = async (categoryId: string, label: string) => {
    const latest = useDataStore
      .getState()
      .categories.find((c) => c.id === categoryId);
    if (!latest || !isUuid(latest.id)) {
      toast.success(`"${label}" saved locally.`);
      return true;
    }

    const sync = await syncCategory(latest);
    if (!sync.ok) {
      toast.error(
        sync.error ??
          "Could not save category sinkers to the server. Run supabase/catch-up-007-011.sql section 017 if you have not yet."
      );
      return false;
    }

    const { requestServerDataSync } = await import(
      "@/services/dataSyncService"
    );
    requestServerDataSync();
    toast.success(`"${label}" saved.`);
    return true;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required.");
      return;
    }

    const parsedSinkers = parseSinkers();
    if (parsedSinkers === null) return;

    setSaving(true);
    try {
      let nextImageUrl = imageUrl.trim() || undefined;

      if (editing) {
        if (imageFile) {
          const uploaded = await uploadCategoryImage(imageFile, editing.id);
          if ("error" in uploaded) {
            toast.error(uploaded.error);
            return;
          }
          nextImageUrl = uploaded.publicUrl;
        }

        updateCategory(editing.id, {
          name: trimmedName,
          slug: slugify(trimmedName),
          description: description.trim() || null,
          ...(nextImageUrl ? { image_url: nextImageUrl } : {}),
        });
        setCategorySinkers(editing.id, parsedSinkers);

        const ok = await persistCategory(editing.id, trimmedName);
        if (!ok) return;
      } else {
        const created = addCategory({
          name: trimmedName,
          description: description.trim() || undefined,
          imageUrl: nextImageUrl,
        });

        setCategorySinkers(created.id, parsedSinkers);

        if (imageFile) {
          const uploaded = await uploadCategoryImage(imageFile, created.id);
          if ("error" in uploaded) {
            toast.error(uploaded.error);
            return;
          }
          updateCategory(created.id, { image_url: uploaded.publicUrl });
        }

        const ok = await persistCategory(created.id, trimmedName);
        if (!ok) return;
      }

      setDialogOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const linked = products.filter((p) => p.category_id === category.id);
    if (linked.length > 0) {
      toast.error(
        `Cannot delete “${category.name}” — ${linked.length} product${linked.length === 1 ? "" : "s"} still use it. Move or delete those products first.`
      );
      return;
    }

    if (
      !window.confirm(
        `Delete “${category.name}”? This cannot be undone.`
      )
    ) {
      return;
    }

    const remote = await removeCategoryRemote(category.id);
    if (!remote.ok) {
      toast.error(remote.error || "Could not delete category.");
      return;
    }

    deleteCategory(category.id);
    const { requestServerDataSync } = await import(
      "@/services/dataSyncService"
    );
    requestServerDataSync();
    toast.success(`"${category.name}" deleted.`);
  };

  const handleToggleActive = (id: string, categoryName: string) => {
    toggleCategoryActive(id);
    const category = categories.find((c) => c.id === id);
    const nowActive = category ? !category.is_active : true;
    toast.success(
      `"${categoryName}" is now ${nowActive ? "enabled" : "disabled"}.`
    );
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;

    const orderedIds = sorted.map((c) => c.id);
    [orderedIds[index], orderedIds[newIndex]] = [
      orderedIds[newIndex],
      orderedIds[index],
    ];

    reorderCategories(orderedIds);
    toast.success("Category order updated.");
  };

  const previewUrl = imageFile
    ? URL.createObjectURL(imageFile)
    : imageUrl.trim() || null;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Add, edit, delete, enable categories, and adjust display order
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <Button
            type="button"
            onClick={openCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
          <DialogContent scrollable className="sm:max-w-lg">
            <DialogStickyHeader>
              <DialogTitle>
                {editing ? "Edit Category" : "Add Category"}
              </DialogTitle>
            </DialogStickyHeader>
            <DialogScrollBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cat-name">Name *</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sparkling Sodas"
                />
              </div>
              <div>
                <Label htmlFor="cat-desc">Description</Label>
                <Textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Refreshing fizzy drinks"
                  rows={2}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Category sinkers
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Default toppings for every drink in this category
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
                    No category sinkers yet. Drinks can still have their own
                    per-drink sinkers.
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
                          id={`cat-sinker-${row.id}`}
                          checked={row.isAvailable}
                          onCheckedChange={(v) =>
                            updateSinker(index, { isAvailable: v === true })
                          }
                        />
                        <Label
                          htmlFor={`cat-sinker-${row.id}`}
                          className="cursor-pointer text-xs text-muted-foreground"
                        >
                          Available to customers
                        </Label>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Label>Category image</Label>
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
                  : editing
                    ? "Save Changes"
                    : "Save Category"}
              </Button>
            </DialogStickyFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {sorted.map((category, index) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card sm:gap-4 sm:p-4"
          >
            <GripVertical className="hidden h-5 w-5 shrink-0 text-muted-foreground/50 sm:block" />
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-14 sm:w-14">
              {category.image_url && (
                <Image
                  src={category.image_url}
                  alt={category.name}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 basis-[40%]">
              <CategoryLabel name={category.name} size="md" className="mb-1.5" />
              <p className="truncate text-sm text-muted-foreground">
                {category.description}
              </p>
              <p className="text-xs text-muted-foreground">
                Order: {category.sort_order}
                {(category.sinkers?.length ?? 0) > 0
                  ? ` · ${category.sinkers!.length} category sinker${
                      category.sinkers!.length === 1 ? "" : "s"
                    }`
                  : ""}
              </p>
            </div>
            <ReorderButtons
              index={index}
              total={sorted.length}
              onMove={moveCategory}
            />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                aria-label={`Edit ${category.name}`}
                onClick={() => openEdit(category)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/70 hover:bg-muted hover:text-navy"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${category.name}`}
                onClick={() => handleDelete(category)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/80 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <Label htmlFor={`cat-${category.id}`} className="text-sm">
                {category.is_active ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id={`cat-${category.id}`}
                checked={category.is_active}
                onCheckedChange={() =>
                  handleToggleActive(category.id, category.name)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReorderButtons({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (index: number, direction: "up" | "down") => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index, "up")}
        className="rounded-lg p-1 text-muted-foreground hover:bg-light-blue disabled:opacity-30"
        aria-label="Move up"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(index, "down")}
        className="rounded-lg p-1 text-muted-foreground hover:bg-light-blue disabled:opacity-30"
        aria-label="Move down"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
