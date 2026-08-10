import type { InventoryItem, Product } from "@/types";

export type IngredientStockLevel = "ok" | "low" | "out" | "missing";

export interface RecipeIngredientStatus {
  inventoryItemId: string;
  name: string;
  unit: string;
  required: number;
  onHand: number;
  minimumStock: number;
  /** How many finished products this ingredient alone can support. */
  makeableFromThis: number;
  level: IngredientStockLevel;
}

export interface ProductStockStatus {
  /** Max sellable units from all ingredients. null = no recipe configured. */
  makeable: number | null;
  level: "ok" | "low" | "out" | "no_recipe";
  ingredients: RecipeIngredientStatus[];
  blockingIngredientNames: string[];
  lowIngredientNames: string[];
}

const LOW_MAKEABLE_THRESHOLD = 5;

function ingredientLevel(
  onHand: number,
  required: number,
  minimumStock: number
): IngredientStockLevel {
  if (required <= 0) return "ok";
  if (onHand < required) return "out";
  if (onHand <= minimumStock) return "low";
  return "ok";
}

/** Max units that can be made from recipes × current inventory. */
export function getProductStockStatus(
  product: Pick<Product, "recipes">,
  inventory: InventoryItem[]
): ProductStockStatus {
  const recipes = product.recipes ?? [];
  if (recipes.length === 0) {
    return {
      makeable: null,
      level: "no_recipe",
      ingredients: [],
      blockingIngredientNames: [],
      lowIngredientNames: [],
    };
  }

  const ingredients: RecipeIngredientStatus[] = recipes.map((recipe) => {
    const item = inventory.find((i) => i.id === recipe.inventory_item_id);
    const required = Number(recipe.quantity_required) || 0;
    if (!item) {
      return {
        inventoryItemId: recipe.inventory_item_id,
        name: "Missing ingredient",
        unit: "",
        required,
        onHand: 0,
        minimumStock: 0,
        makeableFromThis: 0,
        level: "missing" as const,
      };
    }
    const onHand = Number(item.current_quantity) || 0;
    const makeableFromThis =
      required > 0 ? Math.floor(onHand / required) : Number.POSITIVE_INFINITY;
    return {
      inventoryItemId: item.id,
      name: item.name,
      unit: item.unit,
      required,
      onHand,
      minimumStock: Number(item.minimum_stock) || 0,
      makeableFromThis: Number.isFinite(makeableFromThis)
        ? makeableFromThis
        : 0,
      level: ingredientLevel(onHand, required, Number(item.minimum_stock) || 0),
    };
  });

  const makeable = Math.min(
    ...ingredients.map((i) => i.makeableFromThis),
    Number.POSITIVE_INFINITY
  );
  const finiteMakeable = Number.isFinite(makeable) ? Math.max(0, makeable) : 0;

  const blockingIngredientNames = ingredients
    .filter((i) => i.level === "out" || i.level === "missing")
    .map((i) => i.name);
  const lowIngredientNames = ingredients
    .filter((i) => i.level === "low")
    .map((i) => i.name);

  let level: ProductStockStatus["level"] = "ok";
  if (finiteMakeable <= 0 || blockingIngredientNames.length > 0) {
    level = "out";
  } else if (
    lowIngredientNames.length > 0 ||
    finiteMakeable <= LOW_MAKEABLE_THRESHOLD
  ) {
    level = "low";
  }

  return {
    makeable: finiteMakeable,
    level,
    ingredients,
    blockingIngredientNames,
    lowIngredientNames,
  };
}

/** Can customers order this product right now? */
export function isProductOrderable(
  product: Pick<Product, "is_available" | "recipes">,
  inventory: InventoryItem[]
): boolean {
  if (!product.is_available) return false;
  const status = getProductStockStatus(product, inventory);
  // No recipe → cannot order (stock cannot be tracked/deducted).
  if (status.level === "no_recipe") return false;
  return (status.makeable ?? 0) > 0;
}
