"use client";

import * as React from "react";

import { motion, type Variants } from "framer-motion";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.03,
      duration: 0.3,
      ease: "easeOut",
    },
  }),
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

interface AnimatedListProps {
  children: React.ReactNode[];
  staggerIndex?: boolean;
  className?: string;
}

export function AnimatedList({ children, staggerIndex = true, className }: AnimatedListProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) => (
        <motion.div
          custom={staggerIndex ? i : 0}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

interface AnimatedGridProps {
  children: React.ReactNode[];
  staggerIndex?: boolean;
  className?: string;
}

export function AnimatedGrid({ children, staggerIndex = true, className }: AnimatedGridProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) => (
        <motion.div
          custom={staggerIndex ? i : 0}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

interface AnimatedItemProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

export function AnimatedItem({ children, index = 0, className }: AnimatedItemProps) {
  return (
    <motion.div
      custom={index}
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { fadeInUp, fadeIn, scaleIn };
