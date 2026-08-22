/** Remove legacy Zustand persisted catalog slices — cart uses island-coolers-cart-v4. */
export function clearLegacyDataStorage() {
  if (typeof window === "undefined") return;
  const keys = [
    "island-coolers-data-v4",
    "island-coolers-data-v3",
    "island-coolers-data-v2",
    "island-coolers-cart-v3",
    "island-coolers-cart-v2",
    "island-coolers-cart",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
