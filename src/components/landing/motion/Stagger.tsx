"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
};

type StaggerProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay between children in seconds. */
  stagger?: number;
  as?: "div" | "ol" | "ul";
};

export function Stagger({
  children,
  className,
  stagger = 0.1,
  as = "div",
}: StaggerProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const Component = as === "ol" ? motion.ol : as === "ul" ? motion.ul : motion.div;

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-5% 0px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </Component>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  hoverLift?: boolean;
};

export function StaggerItem({
  children,
  className,
  hoverLift = false,
}: StaggerItemProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <li className={className}>{children}</li>;
  }

  return (
    <motion.li
      className={className}
      variants={itemVariants}
      whileHover={
        hoverLift
          ? { y: -4, transition: { duration: 0.2, ease: "easeOut" } }
          : undefined
      }
    >
      {children}
    </motion.li>
  );
}

export function StaggerChipItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <li className={className}>{children}</li>;
  }

  return (
    <motion.li className={className} variants={itemVariants}>
      {children}
    </motion.li>
  );
}
