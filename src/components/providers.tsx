"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { DataSyncProvider } from "@/components/shared/DataSyncProvider";
import { NotificationsSync } from "@/components/shared/NotificationsSync";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OrdersSync } from "@/components/orders/OrdersSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AuthProvider>
          <DataSyncProvider />
          <NotificationsSync />
          <OrdersSync />
          <OfflineBanner />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
