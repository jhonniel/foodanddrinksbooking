import { create } from "zustand";
import type { Order, OrderStatus, DeliveryOrder, Notification } from "@/types";
import { STORE_LOCATION } from "@/data/demo";
import { useDataStore } from "@/stores/data";
import {
  createNotification,
  NotificationTemplates,
} from "@/services/notificationService";
import { deductInventoryForOrder } from "@/services/inventoryService";
import { calculateDeliveryFee } from "@/lib/delivery/pricing";

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
  mergeOrders: (orders: Order[]) => void;
  mergeDeliveries: (deliveries: DeliveryOrder[]) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  assignDriver: (orderId: string, driverId: string) => void;
  updateDeliveryStatus: (
    deliveryId: string,
    status: DeliveryOrder["status"],
    extras?: Partial<DeliveryOrder>
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId?: string) => void;
  addNotification: (n: Notification) => void;
  setDriverOnline: (online: boolean) => void;
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) map.set(item.id, item);
  return Array.from(map.values());
}

function notifyCustomer(
  order: Order,
  status: OrderStatus
): Notification | null {
  const templates: Partial<
    Record<OrderStatus, { type: Notification["type"]; title: string; body: string }>
  > = {
    CONFIRMED: NotificationTemplates.orderConfirmed(order.order_number),
    PREPARING: NotificationTemplates.orderPreparing(order.order_number),
    READY: NotificationTemplates.orderReady(order.order_number),
    OUT_FOR_DELIVERY: NotificationTemplates.outForDelivery(order.order_number),
    DELIVERED: NotificationTemplates.delivered(order.order_number),
  };
  const t = templates[status];
  if (!t) return null;
  return createNotification({
    userId: order.customer_id,
    type: t.type,
    title: t.title,
    body: t.body,
    data: { orderId: order.id },
  });
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
      mergeOrders: (orders) =>
        set((s) => ({ orders: mergeById(s.orders, orders) })),
      mergeDeliveries: (deliveries) =>
        set((s) => ({ deliveries: mergeById(s.deliveries, deliveries) })),

      addOrder: (order) => {
        const staff = useDataStore
          .getState()
          .customers.filter((c) =>
            ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"].includes(c.role)
          );
        const staffNotifs = [
          // Broadcast so any open admin session hears the alert
          createNotification({
            userId: "staff",
            ...NotificationTemplates.newOrderAdmin(order.order_number),
            data: { orderId: order.id },
          }),
          ...staff.map((admin) =>
            createNotification({
              userId: admin.id,
              ...NotificationTemplates.newOrderAdmin(order.order_number),
              data: { orderId: order.id },
            })
          ),
        ];
        set((s) => ({
          orders: [order, ...s.orders],
          notifications: [...staffNotifs, ...s.notifications],
        }));
      },

      updateOrderStatus: (orderId, status) => {
        const now = new Date().toISOString();
        const order = get().orders.find((o) => o.id === orderId);
        const notifs: Notification[] = [];

        if (order) {
          const customerNotif = notifyCustomer(order, status);
          if (customerNotif) notifs.push(customerNotif);

          if (status === "DELIVERED") {
            notifs.push(
              createNotification({
                userId: order.customer_id,
                ...NotificationTemplates.pointsEarned(order.points_earned),
                data: { orderId: order.id },
              })
            );
            void deductInventoryForOrder(
              orderId,
              (order.items || []).map((i) => ({
                product_id: i.product_id,
                quantity: i.quantity,
              }))
            );
          }
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
          notifications: notifs.length
            ? [...notifs, ...s.notifications]
            : s.notifications,
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

      assignDriver: (orderId, driverId) => {
        const now = new Date().toISOString();
        const order = get().orders.find((o) => o.id === orderId);
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
        const notifs: Notification[] = [];

        if (order) {
          notifs.push(
            createNotification({
              userId: order.customer_id,
              ...NotificationTemplates.driverAssigned(
                order.order_number,
                driverName
              ),
              data: { orderId },
            })
          );
          if (driverRecord?.profile_id) {
            notifs.push(
              createNotification({
                userId: driverRecord.profile_id,
                ...NotificationTemplates.newDeliveryDriver(order.order_number),
                data: { orderId },
              })
            );
          }
        }

        if (driverRecord) {
          useDataStore.getState().updateDriver(driverRecord.id, {
            status: "BUSY",
          });
        }

        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  driver_id: assignedDriverId,
                  status: "ASSIGNED" as OrderStatus,
                  updated_at: now,
                }
              : o
          ),
          deliveries: [
            ...s.deliveries.filter((d) => d.order_id !== orderId),
            (() => {
              const lat = order?.delivery_address_snapshot?.latitude;
              const lng = order?.delivery_address_snapshot?.longitude;
              const quote =
                lat != null && lng != null
                  ? calculateDeliveryFee({ lat, lng }, order?.subtotal ?? 0)
                  : null;
              return {
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
            })(),
          ],
          notifications: [...notifs, ...s.notifications],
        }));

        void fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: assignedDriverId,
            driverName,
            driverProfileId: driverRecord?.profile_id,
          }),
        }).catch(() => {
          /* keep optimistic local update if network fails */
        });
      },

      updateDeliveryStatus: (deliveryId, status, extras = {}) => {
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
        const notifs: Notification[] = [];

        if (order && newStatus) {
          const customerNotif = notifyCustomer(order, newStatus);
          if (customerNotif) notifs.push(customerNotif);
          if (newStatus === "DELIVERED") {
            notifs.push(
              createNotification({
                userId: order.customer_id,
                ...NotificationTemplates.pointsEarned(order.points_earned),
                data: { orderId: order.id },
              })
            );
            void deductInventoryForOrder(
              order.id,
              (order.items || []).map((i) => ({
                product_id: i.product_id,
                quantity: i.quantity,
              }))
            );
          }
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
          if (driver && driver.status !== "OFFLINE" && driver.status !== "SUSPENDED") {
            useDataStore.getState().updateDriver(driver.id, {
              status: "ONLINE",
            });
          }
        }

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
          notifications: notifs.length
            ? [...notifs, ...s.notifications]
            : s.notifications,
        }));
      },

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        })),

      markAllNotificationsRead: (userId) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            !userId || n.user_id === userId || n.user_id === "staff"
              ? { ...n, is_read: true }
              : n
          ),
        })),

      addNotification: (n) =>
        set((s) => ({ notifications: [n, ...s.notifications] })),

      setDriverOnline: (online) => set({ driverOnline: online }),
}));
