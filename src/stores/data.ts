import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Category,
  Product,
  ProductAddon,
  ProductOption,
  ProductRecipe,
  InventoryItem,
  Reward,
  Promotion,
  Driver,
  Profile,
  Expense,
  ExpenseCategory,
} from "@/types";
import {
  CATEGORIES,
  PRODUCTS,
  ADDONS,
  INVENTORY,
  REWARDS,
  PROMOTIONS,
  recipesForProduct,
} from "@/data/demo";
import { slugify } from "@/lib/utils/format";

function defaultOptions(productId: string): ProductOption[] {
  return [
    {
      id: `${productId}-opt-size`,
      product_id: productId,
      name: "size",
      display_name: "Size",
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: 1,
      values: [
        {
          id: `${productId}-size-reg`,
          option_id: `${productId}-opt-size`,
          name: "Regular",
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 1,
        },
        {
          id: `${productId}-size-lrg`,
          option_id: `${productId}-opt-size`,
          name: "Large",
          price_adjustment: 20,
          is_default: false,
          is_available: true,
          sort_order: 2,
        },
      ],
    },
    {
      id: `${productId}-opt-ice`,
      product_id: productId,
      name: "ice",
      display_name: "Ice",
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: 2,
      values: [
        {
          id: `${productId}-ice-reg`,
          option_id: `${productId}-opt-ice`,
          name: "Regular",
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 1,
        },
        {
          id: `${productId}-ice-less`,
          option_id: `${productId}-opt-ice`,
          name: "Less Ice",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 2,
        },
        {
          id: `${productId}-ice-none`,
          option_id: `${productId}-opt-ice`,
          name: "No Ice",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 3,
        },
      ],
    },
    {
      id: `${productId}-opt-sweet`,
      product_id: productId,
      name: "sweetness",
      display_name: "Sweetness",
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: 3,
      values: [
        {
          id: `${productId}-sw-100`,
          option_id: `${productId}-opt-sweet`,
          name: "100%",
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 1,
        },
        {
          id: `${productId}-sw-75`,
          option_id: `${productId}-opt-sweet`,
          name: "75%",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 2,
        },
        {
          id: `${productId}-sw-50`,
          option_id: `${productId}-opt-sweet`,
          name: "50%",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 3,
        },
        {
          id: `${productId}-sw-25`,
          option_id: `${productId}-opt-sweet`,
          name: "25%",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 4,
        },
        {
          id: `${productId}-sw-0`,
          option_id: `${productId}-opt-sweet`,
          name: "0%",
          price_adjustment: 0,
          is_default: false,
          is_available: true,
          sort_order: 5,
        },
      ],
    },
  ];
}

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  /** Inventory ingredients used per 1 drink */
  recipes?: { inventoryItemId: string; quantityRequired: number }[];
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface CreateInventoryInput {
  name: string;
  unit: string;
  currentQuantity: number;
  minimumStock: number;
  costPerUnit?: number;
  supplier?: string;
  sku?: string;
}

export interface CreateRewardInput {
  name: string;
  description?: string;
  pointsRequired: number;
  discountValue?: number;
  type?: Reward["type"];
}

export interface CreatePromotionInput {
  name: string;
  description?: string;
  promoCode: string;
  type: Promotion["type"];
  discountValue: number;
  minOrderAmount?: number;
  endsInDays?: number;
}

export interface CreateDriverInput {
  fullName: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehicleNumber?: string;
  /** Real auth account id when created via /api/auth/create-staff */
  profileId?: string;
}

export interface CreateCustomerInput {
  fullName: string;
  email: string;
  phone?: string;
}

export interface CreateExpenseInput {
  title: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  incurredAt?: string;
}

interface DataState {
  hydrated: boolean;
  categories: Category[];
  products: Product[];
  addons: ProductAddon[];
  inventory: InventoryItem[];
  rewards: Reward[];
  promotions: Promotion[];
  drivers: Driver[];
  customers: Profile[];
  expenses: Expense[];
  /** Order ids that already had inventory deducted (idempotent) */
  deductedOrderIds: string[];

  setHydrated: (v: boolean) => void;
  /** Replace customers from Supabase profiles */
  setCustomers: (customers: Profile[]) => void;
  setDrivers: (drivers: Driver[]) => void;
  /** Replace catalog slices when Supabase is the source of truth */
  applyCatalog: (input: {
    categories: Category[];
    products: Product[];
    inventory: InventoryItem[];
  }) => void;

  addProduct: (input: CreateProductInput) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleProductAvailability: (id: string) => void;
  setProductRecipes: (
    productId: string,
    recipes: { inventoryItemId: string; quantityRequired: number }[]
  ) => void;

  addCategory: (input: CreateCategoryInput) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  reorderCategories: (orderedIds: string[]) => void;
  toggleCategoryActive: (id: string) => void;

  addInventoryItem: (input: CreateInventoryInput) => InventoryItem;
  adjustInventory: (id: string, quantity: number, notes?: string) => void;
  /** Subtract amount from current stock (floors at 0) */
  decrementInventory: (id: string, amount: number) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  markOrderInventoryDeducted: (orderId: string) => void;
  wasOrderInventoryDeducted: (orderId: string) => boolean;

  addReward: (input: CreateRewardInput) => Reward;
  updateReward: (id: string, updates: Partial<Reward>) => void;
  toggleRewardActive: (id: string) => void;

  addPromotion: (input: CreatePromotionInput) => Promotion;
  updatePromotion: (id: string, updates: Partial<Promotion>) => void;
  togglePromotionActive: (id: string) => void;

  addDriver: (input: CreateDriverInput) => Driver;
  updateDriver: (id: string, updates: Partial<Driver>) => void;

  addCustomer: (input: CreateCustomerInput) => Profile;
  updateCustomer: (id: string, updates: Partial<Profile>) => void;

  addExpense: (input: CreateExpenseInput) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  resetToSeed: () => void;
}

function seedExpenses(): Expense[] {
  const now = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };
  return [
    {
      id: "exp-rent-1",
      title: "Store rent",
      category: "RENT",
      amount: 18000,
      notes: "Monthly lease",
      incurred_at: iso(2),
      created_at: iso(2),
      updated_at: iso(2),
    },
    {
      id: "exp-util-1",
      title: "Electricity & water",
      category: "UTILITIES",
      amount: 4200,
      notes: null,
      incurred_at: iso(1),
      created_at: iso(1),
      updated_at: iso(1),
    },
    {
      id: "exp-sup-1",
      title: "Cups & packaging",
      category: "SUPPLIES",
      amount: 2500,
      notes: "Restock packaging",
      incurred_at: iso(0),
      created_at: iso(0),
      updated_at: iso(0),
    },
  ];
}

const seedDrivers: Driver[] = [];

const seedCustomers: Profile[] = [];

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      categories: CATEGORIES,
      products: PRODUCTS,
      addons: ADDONS,
      inventory: INVENTORY,
      rewards: REWARDS,
      promotions: PROMOTIONS,
      drivers: seedDrivers,
      customers: seedCustomers,
      expenses: seedExpenses(),
      deductedOrderIds: [],

      setHydrated: (v) => set({ hydrated: v }),
      setCustomers: (customers) => set({ customers }),
      setDrivers: (drivers) => set({ drivers }),

      applyCatalog: ({ categories, products, inventory }) =>
        set({
          categories,
          products,
          inventory,
        }),

      addProduct: (input) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `prod-${Date.now()}`;
        const now = new Date().toISOString();
        const recipes: ProductRecipe[] = (input.recipes ?? [])
          .filter((r) => r.inventoryItemId && r.quantityRequired > 0)
          .map((r) => ({
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `recipe-${id}-${Math.random().toString(36).slice(2, 8)}`,
            product_id: id,
            inventory_item_id: r.inventoryItemId,
            quantity_required: r.quantityRequired,
          }));
        const product: Product = {
          id,
          category_id: input.categoryId,
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description?.trim() || "Fresh Island Coolers drink",
          base_price: input.basePrice,
          image_url:
            input.imageUrl ||
            "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=600&fit=crop",
          sku: `IC-${slugify(input.name).slice(0, 8).toUpperCase()}`,
          is_available: input.isAvailable ?? true,
          is_featured: input.isFeatured ?? false,
          is_best_seller: input.isBestSeller ?? false,
          is_new: input.isNew ?? true,
          preparation_time_minutes: 10,
          rating: 5,
          review_count: 0,
          sort_order: 0,
          created_at: now,
          updated_at: now,
          options: defaultOptions(id),
          addons: get().addons,
          recipes,
        };
        set((s) => ({ products: [product, ...s.products] }));
        return product;
      },

      updateProduct: (id, updates) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          ),
        })),

      setProductRecipes: (productId, recipes) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  recipes: recipes
                    .filter((r) => r.inventoryItemId && r.quantityRequired > 0)
                    .map((r) => ({
                      id:
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `recipe-${productId}-${Date.now()}`,
                      product_id: productId,
                      inventory_item_id: r.inventoryItemId,
                      quantity_required: r.quantityRequired,
                    })),
                  updated_at: new Date().toISOString(),
                }
              : p
          ),
        })),

      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      toggleProductAvailability: (id) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id
              ? {
                  ...p,
                  is_available: !p.is_available,
                  updated_at: new Date().toISOString(),
                }
              : p
          ),
        })),

      addCategory: (input) => {
        const id = `cat-${Date.now()}`;
        const now = new Date().toISOString();
        const category: Category = {
          id,
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description?.trim() || null,
          image_url:
            input.imageUrl ||
            "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=400&fit=crop",
          sort_order: get().categories.length + 1,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ categories: [...s.categories, category] }));
        return category;
      },

      updateCategory: (id, updates) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id
              ? { ...c, ...updates, updated_at: new Date().toISOString() }
              : c
          ),
        })),

      reorderCategories: (orderedIds) =>
        set((s) => ({
          categories: orderedIds
            .map((id, i) => {
              const cat = s.categories.find((c) => c.id === id);
              return cat
                ? { ...cat, sort_order: i + 1, updated_at: new Date().toISOString() }
                : null;
            })
            .filter(Boolean) as Category[],
        })),

      toggleCategoryActive: (id) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id
              ? {
                  ...c,
                  is_active: !c.is_active,
                  updated_at: new Date().toISOString(),
                }
              : c
          ),
        })),

      addInventoryItem: (input) => {
        const id = `inv-${Date.now()}`;
        const now = new Date().toISOString();
        const item: InventoryItem = {
          id,
          name: input.name.trim(),
          sku: input.sku || `INV-${slugify(input.name).slice(0, 8).toUpperCase()}`,
          unit: input.unit,
          current_quantity: input.currentQuantity,
          minimum_stock: input.minimumStock,
          cost_per_unit: input.costPerUnit ?? 0,
          supplier: input.supplier || null,
          last_restocked_at: now,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ inventory: [item, ...s.inventory] }));
        return item;
      },

      adjustInventory: (id, quantity) =>
        set((s) => ({
          inventory: s.inventory.map((item) =>
            item.id === id
              ? {
                  ...item,
                  current_quantity: quantity,
                  last_restocked_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : item
          ),
        })),

      decrementInventory: (id, amount) =>
        set((s) => ({
          inventory: s.inventory.map((item) =>
            item.id === id
              ? {
                  ...item,
                  current_quantity: Math.max(
                    0,
                    Math.round((item.current_quantity - amount) * 1000) / 1000
                  ),
                  updated_at: new Date().toISOString(),
                }
              : item
          ),
        })),

      updateInventoryItem: (id, updates) =>
        set((s) => ({
          inventory: s.inventory.map((item) =>
            item.id === id
              ? { ...item, ...updates, updated_at: new Date().toISOString() }
              : item
          ),
        })),

      markOrderInventoryDeducted: (orderId) =>
        set((s) =>
          s.deductedOrderIds.includes(orderId)
            ? s
            : { deductedOrderIds: [...s.deductedOrderIds, orderId] }
        ),

      wasOrderInventoryDeducted: (orderId) =>
        get().deductedOrderIds.includes(orderId),

      addReward: (input) => {
        const id = `rew-${Date.now()}`;
        const now = new Date().toISOString();
        const reward: Reward = {
          id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          type: input.type || "POINTS_DISCOUNT",
          points_required: input.pointsRequired,
          discount_value: input.discountValue ?? null,
          free_product_id: null,
          image_url: null,
          is_active: true,
          max_redemptions: null,
          current_redemptions: 0,
          sort_order: get().rewards.length + 1,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ rewards: [...s.rewards, reward] }));
        return reward;
      },

      updateReward: (id, updates) =>
        set((s) => ({
          rewards: s.rewards.map((r) =>
            r.id === id
              ? { ...r, ...updates, updated_at: new Date().toISOString() }
              : r
          ),
        })),

      toggleRewardActive: (id) =>
        set((s) => ({
          rewards: s.rewards.map((r) =>
            r.id === id
              ? {
                  ...r,
                  is_active: !r.is_active,
                  updated_at: new Date().toISOString(),
                }
              : r
          ),
        })),

      addPromotion: (input) => {
        const id = `promo-${Date.now()}`;
        const now = new Date().toISOString();
        const ends = new Date();
        ends.setDate(ends.getDate() + (input.endsInDays ?? 30));
        const promotion: Promotion = {
          id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          promo_code: input.promoCode.trim().toUpperCase(),
          type: input.type,
          discount_value: input.discountValue,
          min_order_amount: input.minOrderAmount ?? 0,
          max_discount: null,
          usage_limit: null,
          usage_count: 0,
          starts_at: now,
          ends_at: ends.toISOString(),
          is_active: true,
          image_url: null,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ promotions: [promotion, ...s.promotions] }));
        return promotion;
      },

      updatePromotion: (id, updates) =>
        set((s) => ({
          promotions: s.promotions.map((p) =>
            p.id === id
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          ),
        })),

      togglePromotionActive: (id) =>
        set((s) => ({
          promotions: s.promotions.map((p) =>
            p.id === id
              ? {
                  ...p,
                  is_active: !p.is_active,
                  updated_at: new Date().toISOString(),
                }
              : p
          ),
        })),

      addDriver: (input) => {
        const profileId = input.profileId || `driver-profile-${Date.now()}`;
        const now = new Date().toISOString();
        const profile: Profile = {
          id: profileId,
          email: input.email.trim(),
          full_name: input.fullName.trim(),
          phone: input.phone.trim(),
          avatar_url: null,
          role: "DRIVER",
          is_active: true,
          points_balance: 0,
          lifetime_points: 0,
          created_at: now,
          updated_at: now,
        };
        const driver: Driver = {
          id: `driver-${Date.now()}`,
          profile_id: profileId,
          vehicle_type: input.vehicleType,
          vehicle_number: input.vehicleNumber || null,
          license_number: null,
          status: "OFFLINE",
          rating: 5,
          total_deliveries: 0,
          is_active: true,
          created_at: now,
          updated_at: now,
          profile,
        };
        set((s) => ({
          drivers: [driver, ...s.drivers],
          customers: [
            profile,
            ...s.customers.filter((c) => c.id !== profileId),
          ],
        }));
        return driver;
      },

      updateDriver: (id, updates) =>
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === id
              ? { ...d, ...updates, updated_at: new Date().toISOString() }
              : d
          ),
        })),

      addCustomer: (input) => {
        const now = new Date().toISOString();
        const customer: Profile = {
          id: `customer-${Date.now()}`,
          email: input.email.trim(),
          full_name: input.fullName.trim(),
          phone: input.phone?.trim() || null,
          avatar_url: null,
          role: "CUSTOMER",
          is_active: true,
          points_balance: 0,
          lifetime_points: 0,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ customers: [customer, ...s.customers] }));
        return customer;
      },

      updateCustomer: (id, updates) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id
              ? { ...c, ...updates, updated_at: new Date().toISOString() }
              : c
          ),
        })),

      addExpense: (input) => {
        const now = new Date().toISOString();
        const expense: Expense = {
          id: `exp-${Date.now()}`,
          title: input.title.trim(),
          category: input.category,
          amount: input.amount,
          notes: input.notes?.trim() || null,
          incurred_at: input.incurredAt || now,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ expenses: [expense, ...s.expenses] }));
        return expense;
      },

      updateExpense: (id, updates) =>
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id
              ? { ...e, ...updates, updated_at: new Date().toISOString() }
              : e
          ),
        })),

      deleteExpense: (id) =>
        set((s) => ({
          expenses: s.expenses.filter((e) => e.id !== id),
        })),

      resetToSeed: () =>
        set({
          categories: CATEGORIES,
          products: PRODUCTS,
          addons: ADDONS,
          inventory: INVENTORY,
          rewards: REWARDS,
          promotions: PROMOTIONS,
          drivers: seedDrivers,
          customers: seedCustomers,
          expenses: seedExpenses(),
          deductedOrderIds: [],
        }),
    }),
    {
      name: "island-coolers-data-v3",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Backfill recipes for older persisted products that lack them
        state.products = state.products.map((p) =>
          p.recipes && p.recipes.length > 0
            ? p
            : { ...p, recipes: recipesForProduct(p.id) }
        );
        if (!state.deductedOrderIds) state.deductedOrderIds = [];
        if (!state.expenses) state.expenses = seedExpenses();
        state.setHydrated(true);
      },
    }
  )
);
