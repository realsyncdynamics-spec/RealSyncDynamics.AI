import { motion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
};

/**
 * Fades content in from below on mount. Cheap, GPU-accelerated.
 * Respects prefers-reduced-motion via the global CSS rule in src/index.css.
 */
export function FadeIn({ children, delay = 0, duration = 0.6, y = 12, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
