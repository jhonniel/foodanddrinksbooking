"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  icon?: LucideIcon;
  className?: string;
  /** Numeric value for animated counter (optional) */
  numericValue?: number;
  formatNumber?: (n: number) => string;
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  className,
  numericValue,
  formatNumber,
}: StatsCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-2xl bg-white p-3 shadow-card sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">{title}</p>
        {Icon && (
          <motion.div
            whileHover={reduce ? undefined : { rotate: -6, scale: 1.08 }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-light-blue"
          >
            <Icon className="h-4 w-4 text-sky" />
          </motion.div>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tracking-tight text-navy sm:text-2xl">
        {typeof numericValue === "number" ? (
          <AnimatedNumber value={numericValue} format={formatNumber} />
        ) : (
          value
        )}
      </p>
      {typeof change === "number" && (
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            change >= 0 ? "text-green" : "text-red-500"
          )}
        >
          {change >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>
            {change >= 0 ? "+" : ""}
            {change}% from yesterday
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
