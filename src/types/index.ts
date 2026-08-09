export type UserRole =
  | "CUSTOMER"
  | "STAFF"
  | "MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "DRIVER";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "CANCELLED";

export type OrderType = "DELIVERY" | "PICKUP";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type PaymentMethod = "COD" | "GCASH" | "CARD" | "ONLINE";

export type DriverStatus = "ONLINE" | "OFFLINE" | "BUSY" | "SUSPENDED";

export type DeliveryStatus =
  | "PENDING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "DELIVERED"
  | "CANCELLED";

export type PointsTransactionType =
  | "EARNED"
  | "REDEEMED"
  | "ADJUSTED"
  | "EXPIRED"
  | "BONUS";

export type RewardType =
  | "POINTS_DISCOUNT"
  | "PERCENTAGE_DISCOUNT"
  | "FIXED_DISCOUNT"
  | "FREE_PRODUCT"
  | "PROMOTIONAL";

export type PromotionType =
  | "PERCENTAGE"
  | "FIXED"
  | "FREE_ITEM"
  | "BUY_X_GET_Y"
  | "PROMO_CODE";

export type NotificationType =
  | "ORDER"
  | "DELIVERY"
  | "POINTS"
  | "REWARD"
  | "PROMOTION"
  | "SYSTEM"
  | "INVENTORY";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  points_balance: number;
  lifetime_points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  label: string;
  full_address: string;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_instructions: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  sku: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  preparation_time_minutes: number;
  rating: number;
  review_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  options?: ProductOption[];
  addons?: ProductAddon[];
  /** Inventory ingredients used per single drink */
  recipes?: ProductRecipe[];
}

/** Links a product to inventory stock used when the order is completed */
export interface ProductRecipe {
  id: string;
  product_id: string;
  inventory_item_id: string;
  /** Amount of inventory to deduct per 1 ordered product */
  quantity_required: number;
}

export interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  display_name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  values?: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: string;
  option_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface ProductAddon {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  is_global: boolean;
  sort_order: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_quantity: number;
  minimum_stock: number;
  cost_per_unit: number;
  supplier: string | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  order_type: OrderType;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  points_discount: number;
  tax: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  delivery_address_id: string | null;
  delivery_address_snapshot: AddressSnapshot | null;
  delivery_instructions: string | null;
  driver_id: string | null;
  promotion_id: string | null;
  points_earned: number;
  points_used: number;
  estimated_prep_minutes: number;
  notes: string | null;
  cancelled_reason: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  customer?: Profile;
  driver?: Profile;
  delivery?: DeliveryOrder;
}

export interface AddressSnapshot {
  full_address: string;
  label?: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_instructions?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions: string | null;
  options?: OrderItemOption[];
  addons?: OrderItemAddon[];
}

export interface OrderItemOption {
  id: string;
  order_item_id: string;
  option_name: string;
  value_name: string;
  price_adjustment: number;
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_name: string;
  price: number;
  quantity: number;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  profile_id: string;
  vehicle_type: string;
  vehicle_number: string | null;
  license_number: string | null;
  status: DriverStatus;
  rating: number;
  total_deliveries: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  current_location?: DriverLocation;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

export interface DeliveryOrder {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: DeliveryStatus;
  customer_latitude: number | null;
  customer_longitude: number | null;
  store_latitude: number | null;
  store_longitude: number | null;
  estimated_arrival: string | null;
  distance_km: number | null;
  delivery_fee: number | null;
  delivery_pin: string | null;
  proof_photo_url: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  driver?: Driver;
  order?: Order;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  points_required: number;
  discount_value: number | null;
  free_product_id: string | null;
  image_url: string | null;
  is_active: boolean;
  max_redemptions: number | null;
  current_redemptions: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PointsTransaction {
  id: string;
  customer_id: string;
  order_id: string | null;
  reward_id: string | null;
  type: PointsTransactionType;
  points: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promo_code: string | null;
  type: PromotionType;
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface LoyaltySettings {
  id: string;
  points_per_peso: number;
  peso_per_point: number;
  min_redemption_points: number;
  points_expiry_days: number | null;
  is_active: boolean;
}

export interface CartItemOption {
  optionId: string;
  optionName: string;
  valueId: string;
  valueName: string;
  priceAdjustment: number;
}

export interface CartItemAddon {
  addonId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  basePrice: number;
  quantity: number;
  options: CartItemOption[];
  addons: CartItemAddon[];
  specialInstructions?: string;
}

export interface DashboardStats {
  todaysSales: number;
  ordersToday: number;
  customers: number;
  pendingOrders: number;
  pendingDeliveries: number;
  averageOrderValue: number;
  salesChange: number;
  ordersChange: number;
}
