"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { useDataStore } from "@/stores/data";
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

export default function AdminCategoriesPage() {
  const categories = useDataStore((s) => s.categories);
  const addCategory = useDataStore((s) => s.addCategory);
  const toggleCategoryActive = useDataStore((s) => s.toggleCategoryActive);
  const reorderCategories = useDataStore((s) => s.reorderCategories);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleAddCategory = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required.");
      return;
    }

    addCategory({
      name: trimmedName,
      description: description.trim() || undefined,
    });

    toast.success(`"${trimmedName}" category added.`);
    setDialogOpen(false);
    resetForm();
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

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Enable categories and adjust display order
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-green px-2.5 text-sm font-medium text-white hover:bg-green/90"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
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
              <Button
                className="w-full bg-green hover:bg-green/90"
                onClick={handleAddCategory}
              >
                Save Category
              </Button>
            </div>
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
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
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
              <h3 className="font-semibold text-navy">{category.name}</h3>
              <p className="truncate text-sm text-muted-foreground">
                {category.description}
              </p>
              <p className="text-xs text-muted-foreground">
                Order: {category.sort_order}
              </p>
            </div>
            <ReorderButtons
              index={index}
              total={sorted.length}
              onMove={moveCategory}
            />
            <div className="ml-auto flex items-center gap-2">
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
