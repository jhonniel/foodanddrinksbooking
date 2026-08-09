"use client";

import { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <motion.div
        animate={
          reduce
            ? undefined
            : {
                y: [0, -6, 0],
              }
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-light-blue"
      >
        <Icon className="h-7 w-7 text-sky" aria-hidden />
      </motion.div>
      <h3 className="text-lg font-semibold text-navy">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <motion.div
          className="mt-5"
          whileHover={reduce ? undefined : { scale: 1.03 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
        >
          <Button onClick={onAction} className="bg-green hover:bg-green/90">
            {actionLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
