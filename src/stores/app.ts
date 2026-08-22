import { create } from "zustand";
import type { Order, OrderStatus, DeliveryOrder, Notification } from "@/types";
import { STORE_LOCATION } from "@/data/demo";
import { useDataStore } from "@/stores/data";
import { deductInventoryForOrder } from "@/services/inventoryService";
import { calculateDeliveryFee } from "@/lib/delivery/pricing";
import {
  markAllNotificationsReadRemote,
  markNotificationReadRemote,
} from "@/services/notificationSyncService";

interface AppState {
  orders: Order[];
  deliveries: DeliveryOrder[];
  notifications: Notification[];
  driverOnline: boolean;
  /** Always true — orders are never read from localStorage. */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setOrders: (orders: Order[]) => void;
  setDeliveries: (deliveries: DeliveryOrder[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  mergeOrders: (orders: Order[]) => void;
  mergeDeliveries: (deliveries: DeliveryOrder[]) => void;
  addOrder: (order: Order) => void;
  removeOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  assignDriver: (orderId: string, driverId: string) => Promise<void>;
  updateDeliveryStatus: (
    deliveryId: string,
    status: DeliveryOrder["status"],
    extras?: Partial<DeliveryOrder>
  ) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId?: string) => void;
  setDriverOnline: (online: boolean) => void;
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) map.set(item.id, item);
  return Array.from(map.values());
}

/** Wipe legacy browser caches that used to store orders locally. */
export function clearLegacyOrderLocalStorage() {
  if (typeof window === "undefined") return;
  const keys = [
    "island-coolers-app-v2",
    "island-coolers-app-v3",
    "island-coolers-app-v4",
    "island-coolers-app-v5",
    "island-coolers-app-v6",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export const useAppStore = create<AppState>()((set, get) => ({
      orders: [],
      deliveries: [],
      notifications: [],
      driverOnline: false,
      hasHydrated: true,

      setHasHydrated: (value) => set({ hasHydrated: value }),
      setOrders: (orders) => set({ orders }),
      setDeliveries: (deliveries) => set({ deliveries }),
      setNotifications: (notifications) => set({ notifications }),
      mergeOrders: (orders) =>
        set((s) => ({ orders: mergeById(s.orders, orders) })),
      mergeDeliveries: (deliveries) =>
        set((s) => ({ deliveries: mergeById(s.deliveries, deliveries) })),

      removeOrder: (orderId) =>
        set((s) => ({
          orders: s.orders.filter((o) => o.id !== orderId),
          deliveries: s.deliveries.filter((d) => d.order_id !== orderId),
        })),

      addOrder: (order) => {
        set((s) => ({
          orders: [order, ...s.orders],
        }));
      },

      updateOrderStatus: (orderId, status) => {
        const now = new Date().toISOString();
        const order = get().orders.find((o) => o.id === orderId);

        if (order && status === "DELIVERED") {
          void deductInventoryForOrder(
            orderId,
            (order.items || []).map((i) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            }))
          );
        }

        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const updates: Partial<Order> = { status, updated_at: now };
            if (status === "CONFIRMED") updates.confirmed_at = now;
            if (status === "PREPARING") updates.preparing_at = now;
            if (status === "READY") updates.ready_at = now;
            if (status === "DELIVERED") updates.delivered_at = now;
            if (status === "CANCELLED") updates.cancelled_at = now;
            return { ...o, ...updates };
          }),
        }));

        void fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "CANCELLED"
              ? { cancelledReason: "Cancelled by store" }
              : {}),
          }),
        }).catch(() => {
          /* keep optimistic local update if network fails */
        });
      },

      assignDriver: async (orderId, driverId) => {
        const now = new Date().toISOString();
        const order = get().orders.find((o) => o.id === orderId);
        const existingDelivery = get().deliveries.find(
          (d) => d.order_id === orderId
        );
        const previousDriverId =
          existingDelivery?.driver_id ?? order?.driver_id ?? null;

        const driverRecord =
          useDataStore.getState().drivers.find(
            (d) =>
              d.id === driverId ||
              d.profile_id === driverId ||
              d.profile?.id === driverId
          ) ?? null;
        const driverName =
          driverRecord?.profile?.full_name ?? "Your driver";
        const assignedDriverId = driverRecord?.id ?? driverId;
        const profileDriverId = driverRecord?.profile_id ?? null;
        const isReassign =
          !!previousDriverId && previousDriverId !== assignedDriverId;

        // Free previous driver if they have no other active deliveries
        if (isReassign && previousDriverId) {
          const stillBusy = get().deliveries.some(
            (d) =>
              d.order_id !== orderId &&
              (d.driver_id === previousDriverId ||
                d.driver?.id === previousDriverId) &&
              !["DELIVERED", "CANCELLED"].includes(d.status)
          );
          if (!stillBusy) {
            useDataStore.getState().updateDriver(previousDriverId, {
              status: "ONLINE",
            });
          }
        }

        if (driverRecord) {
          useDataStore.getState().updateDriver(driverRecord.id, {
            status: "BUSY",
          });
        }

        set((s) => {
          const lat = order?.delivery_address_snapshot?.latitude;
          const lng = order?.delivery_address_snapshot?.longitude;
          const quote =
            lat != null && lng != null
              ? calculateDeliveryFee({ lat, lng }, order?.subtotal ?? 0)
              : null;

          const nextDelivery = existingDelivery
            ? {
                ...existingDelivery,
                driver_id: assignedDriverId,
                status: "ASSIGNED" as const,
                assigned_at: now,
                accepted_at: null,
                picked_up_at: null,
                arrived_at: null,
                delivered_at: null,
                updated_at: now,
                estimated_arrival: new Date(
                  Date.now() + (quote?.estimatedMinutes ?? 30) * 60000
                ).toISOString(),
                distance_km:
                  quote?.distanceKm ?? existingDelivery.distance_km,
                driver: driverRecord
                  ? { ...driverRecord, status: "BUSY" as const }
                  : undefined,
              }
            : {
                id: `del-${Date.now()}`,
                order_id: orderId,
                driver_id: assignedDriverId,
                status: "ASSIGNED" as const,
                customer_latitude: lat ?? null,
                customer_longitude: lng ?? null,
                store_latitude: STORE_LOCATION.lat,
                store_longitude: STORE_LOCATION.lng,
                estimated_arrival: new Date(
                  Date.now() + (quote?.estimatedMinutes ?? 30) * 60000
                ).toISOString(),
                distance_km: quote?.distanceKm ?? null,
                delivery_fee: order?.delivery_fee ?? quote?.fee ?? 0,
                delivery_pin: String(Math.floor(1000 + Math.random() * 9000)),
                proof_photo_url: null,
                assigned_at: now,
                accepted_at: null,
                picked_up_at: null,
                arrived_at: null,
                delivered_at: null,
                created_at: now,
                updated_at: now,
                driver: driverRecord
                  ? { ...driverRecord, status: "BUSY" as const }
                  : undefined,
              };

          return {
            orders: s.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    driver_id: profileDriverId ?? assignedDriverId,
                    status: "ASSIGNED" as OrderStatus,
                    updated_at: now,
                  }
                : o
            ),
            deliveries: [
              ...s.deliveries.filter((d) => d.order_id !== orderId),
              nextDelivery,
            ],
          };
        });

        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: assignedDriverId,
            driverName,
            driverProfileId: profileDriverId ?? undefined,
          }),
        });

        const payload = (await res.json().catch(() => null)) as {
          order?: Order;
          delivery?: DeliveryOrder;
          error?: string;
        } | null;

        if (!res.ok || !payload?.order) {
          throw new Error(
            payload?.error || "Failed to save driver assignment to server."
          );
        }

        // Replace optimistic data with authoritative Supabase rows
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, ...payload.order! } : o
          ),
          deliveries: payload.delivery
            ? [
                ...s.deliveries.filter(
                  (d) =>
                    d.order_id !== orderId && d.id !== payload.delivery!.id
                ),
                {
                  ...payload.delivery,
                  driver: driverRecord
                    ? { ...driverRecord, status: "BUSY" as const }
                    : payload.delivery.driver,
                },
              ]
            : s.deliveries,
        }));
      },

      updateDeliveryStatus: async (deliveryId, status, extras = {}) => {
        const now = new Date().toISOString();
        const delivery = get().deliveries.find((d) => d.id === deliveryId);
        const order = delivery
          ? get().orders.find((o) => o.id === delivery.order_id)
          : undefined;

        const orderStatusMap: Partial<
          Record<DeliveryOrder["status"], OrderStatus>
        > = {
          ACCEPTED: "ASSIGNED",
          PICKED_UP: "PICKED_UP",
          IN_TRANSIT: "OUT_FOR_DELIVERY",
          ARRIVED: "ARRIVED",
          DELIVERED: "DELIVERED",
          CANCELLED: "CANCELLED",
        };
        const newStatus = orderStatusMap[status];

        if (order && newStatus === "DELIVERED") {
          void deductInventoryForOrder(
            order.id,
            (order.items || []).map((i) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            }))
          );
        }

        if (
          delivery?.driver_id &&
          (status === "DELIVERED" || status === "CANCELLED")
        ) {
          const driver = useDataStore
            .getState()
            .drivers.find(
              (d) =>
                d.id === delivery.driver_id ||
                d.profile_id === delivery.driver_id
            );
          if (
            driver &&
            driver.status !== "OFFLINE" &&
            driver.status !== "SUSPENDED"
          ) {
            useDataStore.getState().updateDriver(driver.id, {
              status: "ONLINE",
            });
          }
        }

        // Optimistic local update
        set((s) => ({
          deliveries: s.deliveries.map((d) =>
            d.id === deliveryId
              ? {
                  ...d,
                  status,
                  updated_at: now,
                  ...(status === "ACCEPTED" ? { accepted_at: now } : {}),
                  ...(status === "PICKED_UP" ? { picked_up_at: now } : {}),
                  ...(status === "ARRIVED" ? { arrived_at: now } : {}),
                  ...(status === "DELIVERED" ? { delivered_at: now } : {}),
                  ...extras,
                }
              : d
          ),
          orders: s.orders.map((o) => {
            if (!delivery || o.id !== delivery.order_id || !newStatus) return o;
            return {
              ...o,
              status: newStatus,
              updated_at: now,
              ...(newStatus === "DELIVERED" ? { delivered_at: now } : {}),
            };
          }),
        }));

        const res = await fetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        });

        const payload = (await res.json().catch(() => null)) as {
          delivery?: DeliveryOrder;
          order?: Order;
          error?: string;
        } | null;

        if (!res.ok || !payload?.delivery) {
          throw new Error(
            payload?.error || "Failed to save delivery status to server."
          );
        }

        // Authoritative server rows
        set((s) => ({
          deliveries: s.deliveries.map((d) =>
            d.id === deliveryId
              ? { ...d, ...payload.delivery!, order: payload.order ?? d.order }
              : d
          ),
          orders: payload.order
            ? s.orders.map((o) =>
                o.id === payload.order!.id ? { ...o, ...payload.order! } : o
              )
            : s.orders,
        }));
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        }));
        void markNotificationReadRemote(id);
      },

      markAllNotificationsRead: (userId) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            !userId || n.user_id === userId
              ? { ...n, is_read: true }
              : n
          ),
        }));
        void markAllNotificationsReadRemote();
      },

      setDriverOnline: (online) => set({ driverOnline: online }),
}));
