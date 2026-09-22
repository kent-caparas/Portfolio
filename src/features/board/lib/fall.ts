import { clamp } from '@/lib/scatter';
import type { WordPoint } from '@/lib/scene';
import type { Placement } from './board-layout';

export interface Point {
  x: number;
  y: number;
}

export interface NoteFrame {
  transform: string;
  opacity: number;
  flying: boolean;
}

/** a note starts this size relative to a full size globe word */
const START_SCALE = 0.2;
/** notes without a globe word drop in from this far above */
const DROP_HEIGHT = 160;
const DROP_SCALE = 0.9;
/** px of bounce per unit the spring overshoots */
const BOUNCE = 220;

function landedTransform(place: Placement): string {
  return `translate(${place.x}px, ${place.y}px) rotate(${place.r}deg)`;
}

/**
 * Where a note is drawn for fall progress t. `end` is the landed center in
 * viewport px, `start` is its globe word. Past 1 the spring reads as a bounce.
 */
export function noteFrame(
  place: Placement,
  t: number,
  swing: number,
  end: Point,
  start: WordPoint | undefined,
): NoteFrame {
  if (Math.abs(t - 1) < 0.001) return { transform: landedTransform(place), opacity: 1, flying: false };
  if (t <= 0.001) return { transform: landedTransform(place), opacity: 0, flying: false };

  let fromX = end.x;
  let fromY = end.y - DROP_HEIGHT;
  let fromScale = DROP_SCALE;
  if (start) {
    fromX = start.x;
    fromY = start.y;
    fromScale = START_SCALE * start.scale;
  }

  const tc = clamp(t, 0, 1);
  // sideways first, then gravity
  const x = fromX + (end.x - fromX) * (1 - (1 - tc) ** 3);
  const y = fromY + (end.y - fromY) * tc * tc + Math.max(0, t - 1) * BOUNCE;
  const scale = fromScale + (1 - fromScale) * tc;
  const rotate = place.r + swing * (1 - tc);
  return {
    transform: `translate(${place.x + x - end.x}px, ${place.y + y - end.y}px) rotate(${rotate}deg) scale(${scale})`,
    opacity: clamp(t * 5, 0, 1),
    flying: true,
  };
}
