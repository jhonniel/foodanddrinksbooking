"use client";

import {
  AnimatePresence,
  motion,
  type Variants,
  useReducedMotion,
} from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.35, ease: easeOut },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
};

/** Container stays visible — only children animate (avoids fading whole cards). */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const staggerFast: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/** Soft enter for list rows only — keep y small to avoid text blur. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: easeOut },
  },
};

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

/** Route-aware enter/exit for admin & driver shells.
 * Opacity-only — avoid translateY on full pages (causes text ghosting/blur).
 */
export function RouteTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  variants = fadeUp,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  fast = false,
}: {
  children: ReactNode;
  className?: string;
  fast?: boolean;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={fast ? staggerFast : staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  variants = listItem,
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

export function Pressable({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

/** Soft lift for compact cards only — do not wrap tables/lists. */
export function MotionCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={
        reduce ? undefined : { boxShadow: "0 10px 28px rgba(11, 42, 74, 0.08)" }
      }
      whileTap={reduce || !onClick ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.25, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
