import { clamp, hashStr, mulberry32 } from '@/lib/scatter';

export type BoardMode = 'scatter' | 'tidy';

export interface Placement {
  x: number;
  y: number;
  /** rotation in degrees */
  r: number;
}

export interface LayoutNote {
  id: string;
  height: number;
}

export interface BoardLayout {
  noteWidth: number;
  height: number;
  places: Map<string, Placement>;
}

const MAX_NOTE_WIDTH = 236;
const GAP_X = 24;
const GAP_Y = { scatter: 30, tidy: 20 };
const BOTTOM_ROOM = 40;

export function noteWidthFor(boardWidth: number): number {
  return Math.max(160, Math.min(MAX_NOTE_WIDTH, boardWidth - 8));
}

// scatter keeps a stable shuffle so the mess is the same on every visit
function scatterOrder(notes: LayoutNote[]): LayoutNote[] {
  return [...notes].sort((a, b) => hashStr(a.id) - hashStr(b.id));
}

/** Masonry columns. Scatter adds a seeded jitter and tilt, tidy keeps the given order. */
export function layoutBoard(notes: LayoutNote[], boardWidth: number, mode: BoardMode): BoardLayout {
  const noteWidth = noteWidthFor(boardWidth);
  const cols = Math.max(1, Math.floor((boardWidth + GAP_X) / (noteWidth + GAP_X)));
  const used = cols * noteWidth + (cols - 1) * GAP_X;
  const offset = (boardWidth - used) / 2;
  const freeX = boardWidth - noteWidth;
  const colHeights = Array.from({ length: cols }, (_, c) => (mode === 'scatter' ? (c % 2) * 36 : 0));
  const places = new Map<string, Placement>();
  const ordered = mode === 'scatter' ? scatterOrder(notes) : notes;

  for (const note of ordered) {
    const col = colHeights.indexOf(Math.min(...colHeights));
    const rng = mulberry32(hashStr(note.id));
    let x = offset + col * (noteWidth + GAP_X);
    let y = colHeights[col];
    let r = 0;

    if (mode === 'scatter') {
      // a single column has room to wander sideways, wide boards only a little
      const wander = cols === 1 ? freeX : 28;
      x = clamp(x + (rng() - 0.5) * wander + (cols === 1 ? freeX / 2 : 0), 0, freeX);
      y += (rng() - 0.5) * 20;
      r = (rng() - 0.5) * 11;
    }

    places.set(note.id, { x, y: Math.max(0, y), r });
    colHeights[col] += note.height + GAP_Y[mode];
  }

  return { noteWidth, height: Math.max(...colHeights) + BOTTOM_ROOM, places };
}
