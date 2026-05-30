"use client";

import { motion, useReducedMotion } from "motion/react";

type ParallaxTopoProps = {
  className?: string;
  opacity?: number;
};

export function ParallaxTopo({ className, opacity = 0.12 }: ParallaxTopoProps) {
  const reduced = useReducedMotion();

  const style = {
    backgroundImage: "url(/brand/topo-divider.svg)",
    backgroundRepeat: "repeat-x" as const,
    backgroundPosition: "center",
    backgroundSize: "auto 100%",
    opacity,
  };

  if (reduced) {
    return (
      <div
        className={className}
        aria-hidden
        style={style}
      />
    );
  }

  return (
    <motion.div
      className={className}
      aria-hidden
      style={style}
      initial={{ backgroundPositionX: "0%" }}
      whileInView={{ backgroundPositionX: "18%" }}
      viewport={{ once: true }}
      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
