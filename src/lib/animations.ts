import type { Variants } from 'framer-motion'

/** Viewport config — déclenche une seule fois */
export const VP = { once: true, margin: '-60px' } as const

/** Fade + slide up */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

/** Fade uniquement */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
}

/** Scale + fade */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

/** Container stagger — 0.1s entre enfants */
export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

/** Container stagger rapide — 0.06s entre enfants */
export const staggerFast: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
}

/** Hover card — élévation spring */
export const cardHoverProps = {
  whileHover: { y: -6, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } },
  whileTap: { scale: 0.98 as number },
}

/** Transition de page */
export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
}
