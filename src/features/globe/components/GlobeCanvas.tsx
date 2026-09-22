import { useEffect, useRef } from 'preact/hooks';
import { GLOBE_WORDS } from '../lib/globe-words';
import {
  buildRings,
  buildWordPoints,
  rotatePoint,
  type GlobeWord,
  type Vec,
  type WordPoint,
} from '../lib/globe-geometry';
import { globePlacement, globeProgress, miniSpot, type GlobePlacement } from '../lib/globe-placement';
import { fallProgress, wordPoints } from '@/lib/scene';
import { clamp } from '@/lib/scatter';

interface Props {
  looseWords: GlobeWord[];
}

interface DrawnWord {
  id?: string;
  word: string;
  x: number;
  y: number;
  font: number;
}

interface DragState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  moved: boolean;
}

const DRIFT = 0.11; // rad per second, about one turn a minute
const DRAG_SPEED = 0.0065; // rad per px
const MAX_FLING = 14; // rad per second
const REST_TILT = -0.35;
const DOTS_BELOW = 0.42; // under this scale, words draw as dots
const DRAG_THRESHOLD = 4;

export default function GlobeCanvas({ looseWords }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const slot = document.querySelector<HTMLElement>('[data-globe-slot]');
    const hero = document.querySelector<HTMLElement>('[data-hero]');
    if (!button || !canvas || !ctx || !slot || !hero) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const header = document.querySelector('header');
    const toggle = document.querySelector('.theme-toggle');
    const points = buildWordPoints(looseWords, GLOBE_WORDS);
    const rings = buildRings();

    let size = 0;
    let ink = '';
    let accent = '';
    let monoFont = 'monospace';
    let yaw = 0;
    let tilt = REST_TILT;
    let yawVel = reduced ? 0 : DRIFT;
    let place: GlobePlacement = { left: 0, top: 0, scale: 1 };
    let placeKey = '';
    let hovered: string | undefined;
    let drawn: DrawnWord[] = [];
    let drag: DragState | null = null;
    let raf = 0;
    let last = performance.now();

    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function readTheme() {
      const styles = getComputedStyle(document.documentElement);
      ink = styles.getPropertyValue('--color-ink').trim();
      accent = styles.getPropertyValue('--color-accent').trim();
      monoFont = styles.getPropertyValue('--font-mono').trim() || 'monospace';
      kick();
    }

    function resize() {
      size = slot!.clientWidth;
      canvas!.width = Math.round(size * dpr);
      canvas!.height = Math.round(size * dpr);
      button!.style.width = `${size}px`;
      button!.style.height = `${size}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      kick();
    }

    function updatePlacement() {
      const progress = reduced ? 0 : globeProgress(scrollY, hero!.offsetHeight);
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const mini = miniSpot(innerWidth, headerBottom, toggle ? toggle.getBoundingClientRect() : null);
      place = globePlacement(slot!.getBoundingClientRect(), progress, mini);
      const key = `${place.left.toFixed(1)} ${place.top.toFixed(1)} ${place.scale.toFixed(4)}`;
      if (key !== placeKey) {
        placeKey = key;
        button!.style.transform = `translate(${place.left}px, ${place.top}px) scale(${place.scale})`;
      }
      const parked = progress > 0.98;
      button!.classList.toggle('is-mini', parked);
      button!.tabIndex = parked ? 0 : -1;
      button!.setAttribute('aria-hidden', String(!parked));
    }

    function drawRing(ring: Vec[], c: number, R: number, sinT: number, cosT: number) {
      ctx!.beginPath();
      let started = false;
      for (const point of ring) {
        const r = rotatePoint(point, yaw, sinT, cosT);
        if (r.z < -0.05) {
          started = false;
          continue;
        }
        if (started) ctx!.lineTo(c + r.x * R, c + r.y * R);
        else ctx!.moveTo(c + r.x * R, c + r.y * R);
        started = true;
      }
      ctx!.stroke();
    }

    function drawWord(point: WordPoint, x: number, y: number, depth: number, k: number) {
      const loose = Boolean(point.id);
      const isHovered = loose && point.id === hovered;
      let font = (9 + depth * 6) * k;
      if (loose) font *= 1.12;
      if (isHovered) font *= 1.22;
      // Departure Mono is a pixel font, it stays crisp on half steps of 11px
      font = Math.max(11, Math.round(font / 5.5) * 5.5);
      x = Math.round(x);
      y = Math.round(y);
      ctx!.font = `${loose ? 500 : 400} ${font.toFixed(1)}px ${monoFont}`;
      ctx!.fillStyle = loose ? accent : ink;
      ctx!.globalAlpha = loose ? 0.5 + depth * 0.5 : 0.15 + depth * 0.45;
      ctx!.fillText(point.word, x, y);
      if (isHovered) {
        const width = ctx!.measureText(point.word).width;
        ctx!.fillRect(x - width / 2, y + font * 0.62, width, 1.5);
      }
      drawn.push({ id: point.id, word: point.word, x, y, font });
    }

    // dots keep the globe readable once it is corner sized
    function drawDot(point: WordPoint, x: number, y: number, depth: number) {
      const loose = Boolean(point.id);
      ctx!.fillStyle = loose ? accent : ink;
      ctx!.globalAlpha = loose ? 0.95 : 0.2 + depth * 0.4;
      ctx!.beginPath();
      ctx!.arc(x, y, ((loose ? 1.9 : 1.1) * (0.6 + depth * 0.4)) / place.scale, 0, Math.PI * 2);
      ctx!.fill();
    }

    function draw() {
      ctx!.clearRect(0, 0, size, size);
      const c = size / 2;
      const R = size * 0.42;
      const sinT = Math.sin(tilt);
      const cosT = Math.cos(tilt);
      const k = clamp(size / 620, 0.8, 1.25);

      ctx!.strokeStyle = accent;
      ctx!.lineWidth = 1 / Math.max(place.scale, 0.2);
      ctx!.globalAlpha = 0.22 + (1 - place.scale) * 0.25;
      for (const ring of rings) drawRing(ring, c, R, sinT, cosT);

      const asDots = place.scale < DOTS_BELOW;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      drawn = [];
      for (const point of points) {
        const r = rotatePoint(point, yaw, sinT, cosT);
        const x = c + r.x * R;
        const y = c + r.y * R;
        if (point.id) {
          wordPoints.set(point.id, { x: place.left + x * place.scale, y: place.top + y * place.scale, scale: place.scale });
          if ((fallProgress.get(point.id) ?? 0) > 0.02) continue;
        }
        if (r.z < 0) continue;
        const depth = (r.z + 1) / 2;
        if (asDots) drawDot(point, x, y, depth);
        else drawWord(point, x, y, depth, k);
      }
      ctx!.globalAlpha = 1;
    }

    function frame(now: number) {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      updatePlacement();
      if (!drag) {
        if (!reduced) {
          yawVel += (DRIFT - yawVel) * (1 - Math.exp(-dt * 1.2));
          tilt += (REST_TILT - tilt) * (1 - Math.exp(-dt * 2.5));
        }
        yaw += yawVel * dt;
      }
      draw();
      if (!reduced || drag) kick();
    }

    function looseWordAt(clientX: number, clientY: number): string | undefined {
      const x = (clientX - place.left) / place.scale;
      const y = (clientY - place.top) / place.scale;
      for (const word of drawn) {
        if (!word.id) continue;
        const halfWidth = word.word.length * word.font * 0.31 + 6;
        if (Math.abs(x - word.x) < halfWidth && Math.abs(y - word.y) < word.font) return word.id;
      }
      return undefined;
    }

    function setHovered(id: string | undefined) {
      if (id === hovered) return;
      hovered = id;
      slot!.classList.toggle('is-over-word', Boolean(id));
      kick();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastT: event.timeStamp,
        moved: false,
      };
      slot!.setPointerCapture(event.pointerId);
      kick();
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag) {
        setHovered(looseWordAt(event.clientX, event.clientY));
        return;
      }
      const travelled = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.moved && travelled < DRAG_THRESHOLD) return;
      drag.moved = true;
      slot!.classList.add('is-grabbing', 'was-dragged');
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      const seconds = Math.max(event.timeStamp - drag.lastT, 1) / 1000;
      yaw += dx * DRAG_SPEED;
      tilt = clamp(tilt + dy * DRAG_SPEED * 0.6, -1.2, 0.5);
      yawVel = yawVel * 0.4 + ((dx * DRAG_SPEED) / seconds) * 0.6;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      kick();
    }

    function onPointerUp(event: PointerEvent) {
      if (!drag) return;
      const wasClick = !drag.moved;
      // holding still before letting go means no fling
      const held = event.timeStamp - drag.lastT > 90;
      yawVel = clamp(held ? 0 : yawVel, -MAX_FLING, MAX_FLING);
      if (reduced) yawVel = 0;
      drag = null;
      slot!.classList.remove('is-grabbing');
      if (wasClick) {
        const id = looseWordAt(event.clientX, event.clientY);
        if (id) dispatchEvent(new CustomEvent('board:focus', { detail: id }));
      }
      kick();
    }

    function onPointerCancel() {
      drag = null;
      slot!.classList.remove('is-grabbing');
    }

    function onButtonClick() {
      scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }

    readTheme();
    resize();
    button.classList.add('is-ready');

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(slot);
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts?.ready.then(readTheme);
    slot.addEventListener('pointerdown', onPointerDown);
    slot.addEventListener('pointermove', onPointerMove);
    slot.addEventListener('pointerup', onPointerUp);
    slot.addEventListener('pointercancel', onPointerCancel);
    slot.addEventListener('pointerleave', () => setHovered(undefined));
    button.addEventListener('click', onButtonClick);
    addEventListener('scroll', kick, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      removeEventListener('scroll', kick);
    };
  }, []);

  return (
    <button ref={buttonRef} type="button" class="globe" tabIndex={-1} aria-hidden="true" aria-label="Back to the top">
      <canvas ref={canvasRef} />
    </button>
  );
}
