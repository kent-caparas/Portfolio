import { clamp } from '@/lib/scatter';

export interface GlobePlacement {
  left: number;
  top: number;
  /** current size divided by the hero size */
  scale: number;
}

export interface MiniSpot {
  left: number;
  top: number;
  size: number;
}

const MINI_SIZE = { phone: 40, wide: 92 };
const MINI_MARGIN = 20;
const MINI_GAP = 12;
const PHONE_WIDTH = 640;
/** share of the hero height it takes to reach the corner */
const TRAVEL = 0.7;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0 while the globe sits in the hero, 1 once it has shrunk into the corner. */
export function globeProgress(scrollY: number, heroHeight: number): number {
  return easeInOut(clamp(scrollY / (heroHeight * TRAVEL), 0, 1));
}

/** Phones tuck the globe into the header next to the theme toggle, wider screens park it under the header. */
export function miniSpot(viewportWidth: number, headerBottom: number, toggle: DOMRect | null): MiniSpot {
  if (viewportWidth < PHONE_WIDTH && toggle) {
    const size = MINI_SIZE.phone;
    return { left: toggle.left - MINI_GAP - size, top: toggle.top + (toggle.height - size) / 2, size };
  }
  const size = MINI_SIZE.wide;
  return { left: viewportWidth - MINI_MARGIN - size, top: headerBottom + MINI_GAP, size };
}

/** Where the globe sits between its hero slot and its corner spot. */
export function globePlacement(slot: DOMRect, progress: number, mini: MiniSpot): GlobePlacement {
  const size = lerp(slot.width, mini.size, progress);
  return {
    left: lerp(slot.left, mini.left, progress),
    top: lerp(slot.top, mini.top, progress),
    scale: size / slot.width,
  };
}
