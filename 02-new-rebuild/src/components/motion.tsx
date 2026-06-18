"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.div whileHover={{ y: -8, scale: 1.01 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className={cn("h-full", className)}>
      {children}
    </motion.div>
  );
}
