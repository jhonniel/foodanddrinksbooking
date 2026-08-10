import { create } from "zustand";
import type { Profile } from "@/types";
import {
  fetchCurrentProfile,
  loginWithPassword,
  logoutAccount,
  registerAccount,
} from "@/services/authService";
import {
  canAccessAdmin,
  canAccessDriver,
  isStaffRole,
} from "@/lib/auth/config";

interface AuthState {
  user: Profile | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  initializing: boolean;
  setUser: (user: Profile | null) => void;
  initialize: () => Promise<void>;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    password: string;
    fullName: string;
    phone: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    bootstrappedAdmin?: boolean;
  }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<Profile>) => void;
}

/**
 * Auth is session-cookie based only — nothing is persisted to localStorage,
 * so a logged-out browser never shows a stale user.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,
  initializing: true,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  initialize: async () => {
    set({ initializing: true });
    try {
      const profile = await fetchCurrentProfile();
      set({
        user: profile,
        isAuthenticated: !!profile,
        initializing: false,
        hydrated: true,
      });
      if (!profile) {
        // Drop any leftover auth cache from older app versions
        try {
          localStorage.removeItem("island-coolers-auth");
          localStorage.removeItem("island-coolers-auth-v2");
        } catch {
          /* ignore */
        }
      }
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        initializing: false,
        hydrated: true,
      });
      try {
        localStorage.removeItem("island-coolers-auth");
        localStorage.removeItem("island-coolers-auth-v2");
      } catch {
        /* ignore */
      }
    }
  },

  login: async (email, password) => {
    const result = await loginWithPassword(email, password);
    if (!result.success || !result.profile) {
      return { ok: false, error: result.error ?? "Login failed." };
    }
    get().setUser(result.profile);
    return { ok: true };
  },

  register: async (input) => {
    const result = await registerAccount(input);
    if (!result.success || !result.profile) {
      return { ok: false, error: result.error ?? "Registration failed." };
    }
    get().setUser(result.profile);
    return {
      ok: true,
      bootstrappedAdmin: result.bootstrappedAdmin,
    };
  },

  logout: async () => {
    await logoutAccount();
    const { useCartStore } = await import("@/stores/cart");
    useCartStore.getState().clearCart();
    try {
      localStorage.removeItem("island-coolers-auth");
      localStorage.removeItem("island-coolers-auth-v2");
    } catch {
      /* ignore */
    }
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) =>
    set((s) => ({
      user: s.user ? { ...s.user, ...updates } : null,
    })),
}));

export { isStaffRole, canAccessAdmin, canAccessDriver };
