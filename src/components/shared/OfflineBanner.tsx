"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          role="alert"
          className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-navy px-4 py-2.5 text-sm font-medium text-white"
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          You&apos;re offline. Some actions may not work until you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
