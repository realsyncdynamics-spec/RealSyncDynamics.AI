import { motion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  amount?: number;
  className?: string;
};

/**
 * Reveals content when its viewport intersection passes `amount` (0–1).
 * Animation runs once — no bounce when the element re-enters the viewport.
 */
export function ScrollReveal({
  children,
  delay = 0,
  duration = 0.7,
  y = 24,
  amount = 0.2,
  className,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
