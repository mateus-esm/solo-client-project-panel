import type { Variants } from "framer-motion";

export const redBullSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 28,
};

export const smoothSpring = {
  type: "spring" as const,
  stiffness: 280,
  damping: 26,
};

export const momentumEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

export const itemUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: redBullSpring },
};

export const itemUpSoft: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: smoothSpring },
};

export const itemLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: redBullSpring },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: redBullSpring },
};
