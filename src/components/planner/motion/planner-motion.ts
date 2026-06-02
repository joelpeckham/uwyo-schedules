const PLANNER_EASE_OUT = [0.22, 1, 0.36, 1] as const;

const CAROUSEL_REVEAL_STAGGER = 0.04;
const CAROUSEL_REVEAL_DELAY_CHILDREN = 0.02;

export const carouselRevealContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: CAROUSEL_REVEAL_STAGGER,
      delayChildren: CAROUSEL_REVEAL_DELAY_CHILDREN,
    },
  },
} as const;

export const carouselRevealItem = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: PLANNER_EASE_OUT },
  },
} as const;

export const carouselRevealInstant = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
} as const;

export function carouselRevealItemTransition(
  index: number,
  expanded: boolean,
  reducedMotion: boolean,
) {
  if (!expanded || reducedMotion) {
    return { duration: 0 };
  }
  return {
    duration: 0.2,
    delay: CAROUSEL_REVEAL_DELAY_CHILDREN + index * CAROUSEL_REVEAL_STAGGER,
    ease: PLANNER_EASE_OUT,
  };
}
