import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PublicNote } from '@/server/wall/types';
import Note, { type NotePosition } from './Note';
import NoteForm, { type SubmittedNote } from './NoteForm';
import EmptyState from './EmptyState';

const NOTE_W = 230;
const NOTE_H = 150;
const PAD = 16;
const MOBILE_BP = 640;

// Deterministic per-note layout: same id → same scatter, so a refresh keeps the
// session's arrangement stable. Drags are ephemeral and never persisted.
function hashStr(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DragSession {
  id: string;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
}

interface WallProps {
  initialNotes: PublicNote[];
}

export default function Wall({ initialNotes }: WallProps) {
  const [notes, setNotes] = useState<PublicNote[]>(initialNotes);
  const [width, setWidth] = useState(0);
  const [positions, setPositions] = useState<Record<string, NotePosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);

  const idsKey = notes.map((n) => n.id).join(',');

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [notes.length === 0]);

  const canvasHeight = useMemo(() => {
    if (width <= 0) return 0;
    const perRow = Math.max(1, Math.floor(width / (NOTE_W + 24)));
    const rows = Math.max(1, Math.ceil(notes.length / perRow));
    return rows * (NOTE_H + 48) + 80;
  }, [width, notes.length]);

  useEffect(() => {
    if (width <= 0) return;
    const maxX = Math.max(PAD, width - NOTE_W - PAD);
    const maxY = Math.max(PAD, canvasHeight - NOTE_H - PAD);
    const next: Record<string, NotePosition> = {};
    notes.forEach((note, index) => {
      const rng = mulberry32(hashStr(note.id));
      next[note.id] = {
        x: PAD + rng() * (maxX - PAD),
        y: PAD + rng() * (maxY - PAD),
        rotate: -6 + rng() * 12,
        zIndex: notes.length - index, // newer notes (front of array) sit on top
      };
    });
    setPositions(next);
    // idsKey captures note-set changes; width/height capture reflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, canvasHeight, idsKey]);

  // Single set of window listeners; the drag session lives in a ref so we don't
  // re-bind on every render.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      const dx = event.clientX - session.pointerStartX;
      const dy = event.clientY - session.pointerStartY;
      setPositions((prev) => {
        const current = prev[session.id];
        if (!current) return prev;
        return { ...prev, [session.id]: { ...current, x: session.originX + dx, y: session.originY + dy } };
      });
    };
    const end = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDraggingId(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  function handlePointerDown(event: PointerEvent, id: string) {
    if (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BP) return; // stacked layout, no drag
    const pos = positions[id];
    if (!pos) return;
    event.preventDefault();
    dragRef.current = {
      id,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setDraggingId(id);
    setPositions((prev) => ({ ...prev, [id]: { ...prev[id], zIndex: 9999 } }));
  }

  function handleSubmitted(submitted: SubmittedNote) {
    if (submitted.status !== 'approved') return;
    const optimistic: PublicNote = {
      id: submitted.noteId,
      name: submitted.name,
      topic: submitted.topic,
      body: submitted.body,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [optimistic, ...prev]);
  }

  return (
    <div class="wall">
      <NoteForm onSubmitted={handleSubmitted} />

      {notes.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          class="wall-canvas"
          ref={canvasRef}
          style={canvasHeight ? { height: `${canvasHeight}px` } : undefined}
        >
          {notes.map(
            (note) =>
              positions[note.id] && (
                <Note
                  key={note.id}
                  note={note}
                  position={positions[note.id]}
                  dragging={draggingId === note.id}
                  onPointerDown={handlePointerDown}
                />
              ),
          )}
        </div>
      )}
    </div>
  );
}
