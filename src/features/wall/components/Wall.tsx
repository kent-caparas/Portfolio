import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PublicNote } from '@/server/wall/types';
import Note, { type NotePosition } from './Note';
import NoteForm, { type SubmittedNote } from './NoteForm';
import EmptyState from './EmptyState';

const NOTE_W = 230;
const NOTE_H = 150;
const PAD = 16;
const MOBILE_BP = 640;
const DRAG_THRESHOLD = 4;
const HOME = { x: PAD, y: PAD };

interface Pos {
  x: number;
  y: number;
}

// Deterministic per-note layout: same id → same scatter. Manual positions
// (drags + drops) override the deterministic base and survive recompute.
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

interface DragSession {
  kind: 'note' | 'new';
  id: string;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

interface WallProps {
  initialNotes: PublicNote[];
}

export default function Wall({ initialNotes }: WallProps) {
  const [notes, setNotes] = useState<PublicNote[]>(initialNotes);
  const [width, setWidth] = useState(0);
  const [positions, setPositions] = useState<Record<string, NotePosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [blankPos, setBlankPos] = useState<Pos>(HOME);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const manualRef = useRef<Record<string, Pos>>({});
  const blankPosRef = useRef<Pos>(HOME);
  const dropPosRef = useRef<Pos | null>(null);
  const suppressClickRef = useRef(false);

  const idsKey = notes.map((n) => n.id).join(',');

  function isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BP;
  }

  function setBlank(pos: Pos) {
    blankPosRef.current = pos;
    setBlankPos(pos);
  }

  function clampToCanvas(pos: Pos): Pos {
    const el = canvasRef.current;
    const w = el ? el.clientWidth : width;
    const h = el ? el.clientHeight : 0;
    return {
      x: clamp(pos.x, PAD, Math.max(PAD, w - NOTE_W - PAD)),
      y: clamp(pos.y, PAD, Math.max(PAD, h - NOTE_H - PAD)),
    };
  }

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasHeight = useMemo(() => {
    if (width <= 0) return 0;
    const perRow = Math.max(1, Math.floor(width / (NOTE_W + 24)));
    const rows = Math.max(1, Math.ceil((notes.length + 1) / perRow)); // +1 for the blank note
    return Math.max(rows * (NOTE_H + 48) + 80, 360);
  }, [width, notes.length]);

  useEffect(() => {
    if (width <= 0) return;
    const maxX = Math.max(PAD, width - NOTE_W - PAD);
    const maxY = Math.max(PAD, canvasHeight - NOTE_H - PAD);
    const next: Record<string, NotePosition> = {};
    notes.forEach((note, index) => {
      const rng = mulberry32(hashStr(note.id));
      const base = { x: PAD + rng() * (maxX - PAD), y: PAD + rng() * (maxY - PAD) };
      const rotate = -6 + rng() * 12;
      const manual = manualRef.current[note.id];
      next[note.id] = {
        x: manual ? manual.x : base.x,
        y: manual ? manual.y : base.y,
        rotate,
        zIndex: notes.length - index, // newer notes sit on top
      };
    });
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, canvasHeight, idsKey]);

  // Single set of window listeners; the live drag lives in a ref.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      const dx = event.clientX - session.pointerStartX;
      const dy = event.clientY - session.pointerStartY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) session.moved = true;
      const x = session.originX + dx;
      const y = session.originY + dy;

      if (session.kind === 'new') {
        setBlank({ x, y });
        return;
      }
      manualRef.current[session.id] = { x, y };
      setPositions((prev) => {
        const current = prev[session.id];
        if (!current) return prev;
        return { ...prev, [session.id]: { ...current, x, y } };
      });
    };

    const end = () => {
      const session = dragRef.current;
      if (!session) return;
      dragRef.current = null;
      setDraggingId(null);

      if (session.kind === 'new') {
        if (session.moved) {
          dropPosRef.current = clampToCanvas(blankPosRef.current);
          suppressClickRef.current = true; // a click fires after the drag; ignore it
          openDialog();
        }
        setBlank(HOME);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNotePointerDown(event: PointerEvent, id: string) {
    if (isMobile()) return; // stacked layout, no drag
    const pos = positions[id];
    if (!pos) return;
    event.preventDefault();
    dragRef.current = {
      kind: 'note',
      id,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    setDraggingId(id);
    setPositions((prev) => ({ ...prev, [id]: { ...prev[id], zIndex: 9999 } }));
  }

  function handleBlankPointerDown(event: PointerEvent) {
    if (isMobile()) return; // tap is handled by the click fallback
    event.preventDefault();
    dragRef.current = {
      kind: 'new',
      id: '__new__',
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originX: blankPosRef.current.x,
      originY: blankPosRef.current.y,
      moved: false,
    };
    setDraggingId('__new__');
  }

  function handleBlankClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    dropPosRef.current = null;
    openDialog();
  }

  function handleBlankKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dropPosRef.current = null;
      openDialog();
    }
  }

  function handleDialogClick(event: MouseEvent) {
    if (event.target === dialogRef.current) closeDialog(); // backdrop click
  }

  function handleSubmitted(submitted: SubmittedNote) {
    if (submitted.status === 'approved') {
      if (dropPosRef.current) manualRef.current[submitted.noteId] = dropPosRef.current;
      const optimistic: PublicNote = {
        id: submitted.noteId,
        name: submitted.name,
        topic: submitted.topic,
        body: submitted.body,
        createdAt: new Date().toISOString(),
      };
      setNotes((prev) => [optimistic, ...prev]);
    }
    dropPosRef.current = null;
  }

  const blankStyle = {
    left: `${blankPos.x}px`,
    top: `${blankPos.y}px`,
    transform: 'rotate(-2deg)',
    zIndex: 10001,
  };

  return (
    <div class="wall">
      <div
        class="wall-canvas"
        ref={canvasRef}
        style={canvasHeight ? { height: `${canvasHeight}px` } : undefined}
      >
        <div
          class={`wall-note wall-note--new${draggingId === '__new__' ? ' is-dragging' : ''}`}
          style={blankStyle}
          role="button"
          tabIndex={0}
          aria-label="leave a note"
          onPointerDown={handleBlankPointerDown}
          onClick={handleBlankClick}
          onKeyDown={handleBlankKeyDown}
        >
          <span class="wall-note--new__label">+ leave a note</span>
          <span class="wall-note--new__hint">drag me onto the wall · or tap</span>
        </div>

        {notes.length === 0 && <EmptyState />}

        {notes.map(
          (note) =>
            positions[note.id] && (
              <Note
                key={note.id}
                note={note}
                position={positions[note.id]}
                dragging={draggingId === note.id}
                onPointerDown={handleNotePointerDown}
              />
            ),
        )}
      </div>

      <dialog ref={dialogRef} class="wall-dialog" onClick={handleDialogClick}>
        <div class="wall-dialog__panel">
          <div class="wall-dialog__head">
            <span class="wall-dialog__title">leave a note</span>
            <button class="wall-dialog__close" type="button" aria-label="close" onClick={closeDialog}>
              ×
            </button>
          </div>
          <NoteForm onSubmitted={handleSubmitted} />
        </div>
      </dialog>
    </div>
  );
}
