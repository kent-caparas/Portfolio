import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import BoardNote from './BoardNote';
import { layoutBoard, noteWidthFor, type BoardMode, type Placement } from '../lib/board-layout';
import { noteFrame, type NoteFrame } from '../lib/fall';
import { snapSpring, spring, stepSpring, type Spring, type SpringConfig } from '../lib/spring';
import type { BoardItem } from '../lib/board-items';
import { fallProgress, wordPoints } from '@/lib/scene';
import { clamp, hashStr, mulberry32 } from '@/lib/scatter';
import type { PublicNote } from '@/server/wall/types';

interface Props {
  items: BoardItem[];
}

interface Body {
  x: Spring;
  y: Spring;
  r: Spring;
  fall: Spring;
  landed: boolean;
  /** extra spin in degrees while falling */
  swing: number;
  height: number;
  /** stacking order, bumped when dragged */
  stack: number;
  /** springs hold still until then, so tidy up cascades */
  holdUntil: number;
  painted: { transform: string; opacity: number; z: number; flying: boolean };
}

interface DragSession {
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

const FALL: SpringConfig = { stiffness: 42, damping: 7.8, rest: 0.002 };
const MOVE: SpringConfig = { stiffness: 190, damping: 24, rest: 0.05 };
/** a note lets go once its spot passes this share of the viewport, and flies home past the second */
const LAND_AT = 0.85;
const LIFT_AT = 0.95;
const CASCADE_MS = 22;
const MOBILE_BP = 640;
const DRAG_THRESHOLD = 4;
const VISITOR_LIMIT = 6;
const Z = { base: 3, flying: 40, dragging: 45 };

function makeBody(id: string, stack: number): Body {
  const rng = mulberry32(hashStr(`${id}:fall`));
  return {
    x: spring(0),
    y: spring(0),
    r: spring(0),
    fall: spring(0),
    landed: false,
    swing: (rng() - 0.5) * 80,
    height: 0,
    stack,
    holdUntil: 0,
    painted: { transform: '', opacity: -1, z: -1, flying: false },
  };
}

function visitorItem(note: PublicNote): BoardItem {
  return {
    id: `visitor-${note.id}`,
    kind: 'visitor',
    label: note.name || 'anon',
    meta: note.topic,
    topic: note.topic,
    body: note.body,
    createdAt: note.createdAt,
  };
}

function toggleLabel(mode: BoardMode): string {
  if (mode === 'scatter') return 'tidy up';
  return 'mess it up';
}

function zFor(body: Body, frame: NoteFrame, dragging: boolean): number {
  if (dragging) return Z.dragging;
  if (frame.flying) return Z.flying;
  return Z.base + body.stack;
}

/** Writes only what changed since the last frame. */
function paint(el: HTMLElement, body: Body, frame: NoteFrame, z: number) {
  const painted = body.painted;
  if (frame.transform !== painted.transform) el.style.transform = frame.transform;
  if (frame.opacity !== painted.opacity) {
    el.style.opacity = String(frame.opacity);
    // hidden notes stay focusable, so tabbing to one scrolls it in and it lands
    el.style.pointerEvents = frame.opacity === 0 ? 'none' : '';
  }
  if (z !== painted.z) el.style.zIndex = String(z);
  // a promoted layer only while flying, so landed text re-rasterizes crisp
  if (frame.flying !== painted.flying) el.style.willChange = frame.flying ? 'transform' : '';
  body.painted = { transform: frame.transform, opacity: frame.opacity, z, flying: frame.flying };
}

/** Advances one note. Returns true while it still needs frames. */
function stepBody(
  body: Body,
  target: Placement,
  spotTop: number,
  dt: number,
  now: number,
  snap: boolean,
  dragging: boolean,
): boolean {
  if (spotTop < innerHeight * LAND_AT) body.landed = true;
  else if (spotTop > innerHeight * LIFT_AT) body.landed = false;

  let busy = false;
  if (snap) snapSpring(body.fall, Number(body.landed));
  else busy = !stepSpring(body.fall, Number(body.landed), dt, FALL);

  if (dragging) return true;
  if (snap) {
    snapSpring(body.x, target.x);
    snapSpring(body.y, target.y);
    snapSpring(body.r, target.r);
    return busy;
  }
  if (now < body.holdUntil) return true;

  const xDone = stepSpring(body.x, target.x, dt, MOVE);
  const yDone = stepSpring(body.y, target.y, dt, MOVE);
  const rDone = stepSpring(body.r, target.r, dt, MOVE);
  return busy || !xDone || !yDone || !rDone;
}

export default function Board({ items }: Props) {
  const [visitors, setVisitors] = useState<BoardItem[]>([]);
  const [mode, setMode] = useState<BoardMode>('scatter');
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const bodies = useRef(new Map<string, Body>());
  const targets = useRef(new Map<string, Placement>());
  const manual = useRef(new Map<string, Placement>());
  const dragRef = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const noteWidth = useRef(0);
  const stackTop = useRef(0);
  const reduced = useRef(false);
  const kick = useRef<() => void>(() => {});

  const all = [...items, ...visitors];
  const idsKey = all.map((item) => item.id).join(',');
  const live = width > 0;

  useEffect(() => {
    fetch(`/api/wall/notes?limit=${VISITOR_LIMIT}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; notes?: PublicNote[] } | null) => {
        if (!data?.ok || !data.notes?.length) return;
        setVisitors(data.notes.map(visitorItem));
      })
      .catch(() => {});
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  useLayoutEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const board = boardRef.current;
    if (!board) return;
    const update = () => setWidth(board.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  // measure every note at its live width, then place it
  useLayoutEffect(() => {
    if (!live) return;
    const now = performance.now();
    const notes = all.map((item, index) => {
      let body = bodies.current.get(item.id);
      if (!body) {
        body = makeBody(item.id, index);
        bodies.current.set(item.id, body);
        stackTop.current = Math.max(stackTop.current, index);
      }
      body.height = els.current.get(item.id)?.offsetHeight ?? 120;
      return { id: item.id, height: body.height };
    });

    const layout = layoutBoard(notes, width, mode);
    noteWidth.current = layout.noteWidth;
    all.forEach((item, index) => {
      const body = bodies.current.get(item.id)!;
      const place = manual.current.get(item.id) ?? layout.places.get(item.id)!;
      const isNew = !targets.current.has(item.id);
      targets.current.set(item.id, place);
      if (isNew) {
        snapSpring(body.x, place.x);
        snapSpring(body.y, place.y);
        snapSpring(body.r, place.r);
        return;
      }
      body.holdUntil = now + index * CASCADE_MS;
    });
    setHeight(layout.height);
    kick.current();
  }, [live, width, mode, idsKey, fontsReady]);

  useEffect(() => {
    if (!live) return;
    let raf = 0;
    let last = performance.now();
    let first = true;

    const frame = (now: number) => {
      raf = 0;
      const board = boardRef.current;
      if (!board) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const rect = board.getBoundingClientRect();
      const snap = first || reduced.current;
      let busy = Boolean(dragRef.current);

      for (const [id, body] of bodies.current) {
        const el = els.current.get(id);
        const target = targets.current.get(id);
        if (!el || !target) continue;
        const dragging = dragRef.current?.id === id;
        const spotTop = reduced.current ? -Infinity : rect.top + target.y;
        busy = stepBody(body, target, spotTop, dt, now, snap, dragging) || busy;
        fallProgress.set(id, body.fall.value);

        const place = { x: body.x.value, y: body.y.value, r: body.r.value };
        const end = { x: rect.left + place.x + noteWidth.current / 2, y: rect.top + place.y + body.height / 2 };
        const noteState = noteFrame(place, body.fall.value, body.swing, end, wordPoints.get(id));
        paint(el, body, noteState, zFor(body, noteState, dragging));
      }

      first = false;
      if (busy) raf = requestAnimationFrame(frame);
    };

    const run = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kick.current = run;
    addEventListener('scroll', run, { passive: true });
    run();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', run);
      kick.current = () => {};
    };
  }, [live]);

  // one set of window listeners, the live drag sits in a ref
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const session = dragRef.current;
      const board = boardRef.current;
      if (!session || !board) return;
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!session.moved) {
        session.moved = true;
        els.current.get(session.id)?.classList.add('is-dragging');
      }
      const body = bodies.current.get(session.id);
      if (!body) return;
      const x = clamp(session.originX + dx, 0, board.clientWidth - noteWidth.current);
      const y = clamp(session.originY + dy, 0, board.clientHeight - body.height);
      snapSpring(body.x, x);
      snapSpring(body.y, y);
      const place = { x, y, r: targets.current.get(session.id)?.r ?? 0 };
      targets.current.set(session.id, place);
      manual.current.set(session.id, place);
      kick.current();
    };

    const end = () => {
      const session = dragRef.current;
      if (!session) return;
      dragRef.current = null;
      els.current.get(session.id)?.classList.remove('is-dragging');
      if (session.moved) suppressClick.current = true;
      kick.current();
    };

    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
    };
  }, []);

  // a click on a red globe word scrolls to its note and pulses it
  useEffect(() => {
    const onFocus = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const board = boardRef.current;
      const target = targets.current.get(id);
      const body = bodies.current.get(id);
      const el = els.current.get(id);
      if (!board || !target || !body || !el) return;
      const top = board.getBoundingClientRect().top + scrollY + target.y + body.height / 2 - innerHeight / 2;
      scrollTo({ top, behavior: reduced.current ? 'auto' : 'smooth' });
      el.classList.remove('is-called');
      void el.offsetWidth;
      el.classList.add('is-called');
    };
    addEventListener('board:focus', onFocus);
    return () => removeEventListener('board:focus', onFocus);
  }, []);

  function handlePointerDown(event: PointerEvent, id: string) {
    suppressClick.current = false;
    if (event.button !== 0 || innerWidth <= MOBILE_BP) return;
    const body = bodies.current.get(id);
    if (!body || Math.abs(body.fall.value - 1) > 0.01) return;
    body.stack = ++stackTop.current;
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: body.x.value,
      originY: body.y.value,
      moved: false,
    };
  }

  // a drag ends in a click, which must not follow the link
  function handleClick(event: MouseEvent) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
  }

  function handleToggle() {
    manual.current.clear();
    setMode((current) => (current === 'scatter' ? 'tidy' : 'scatter'));
  }

  function setNoteEl(id: string, el: HTMLElement | null) {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }

  let boardClass = 'board';
  let boardStyle: Record<string, string> | undefined;
  if (live) {
    boardClass = 'board is-live';
    boardStyle = { '--note-w': `${noteWidthFor(width)}px` };
    if (height) boardStyle.height = `${height}px`;
  }

  return (
    <div class="board-wrap">
      <div class="board-head">
        <div>
          <h2 class="board-title">the wall</h2>
          <p class="board-sub">notes from me, and from people who stopped by.</p>
        </div>
        <button type="button" class="board-toggle" onClick={handleToggle}>
          {toggleLabel(mode)}
        </button>
      </div>
      <div ref={boardRef} class={boardClass} style={boardStyle}>
        {all.map((item) => (
          <BoardNote
            key={item.id}
            item={item}
            noteRef={(el) => setNoteEl(item.id, el)}
            onPointerDown={(event) => handlePointerDown(event, item.id)}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
}
