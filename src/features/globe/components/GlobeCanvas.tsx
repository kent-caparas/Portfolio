import { useEffect, useRef } from 'preact/hooks';
import { GLOBE_WORDS } from '../lib/globe-words';

type Vec = { x: number; y: number; z: number };
type WordPoint = Vec & { word: string };

export default function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let R = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      R = Math.min(w, h) * 0.42;
    }
    resize();
    window.addEventListener('resize', resize);

    // fibonacci-sphere placement, one position per word
    const N = GLOBE_WORDS.length;
    const pts: WordPoint[] = [];
    const phi = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      pts.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        word: GLOBE_WORDS[i],
      });
    }

    // latitude rings for the wireframe feel
    const latLines: Vec[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const ring: Vec[] = [];
      const yy = Math.sin((lat * Math.PI) / 180);
      const rr = Math.cos((lat * Math.PI) / 180);
      for (let a = 0; a < 360; a += 4) {
        const rad = (a * Math.PI) / 180;
        ring.push({ x: Math.cos(rad) * rr, y: yy, z: Math.sin(rad) * rr });
      }
      latLines.push(ring);
    }
    // longitude rings
    const lonLines: Vec[][] = [];
    for (let lon = 0; lon < 360; lon += 30) {
      const ring: Vec[] = [];
      const rad = (lon * Math.PI) / 180;
      for (let a = -90; a <= 90; a += 4) {
        const arad = (a * Math.PI) / 180;
        ring.push({
          x: Math.cos(arad) * Math.cos(rad),
          y: Math.sin(arad),
          z: Math.cos(arad) * Math.sin(rad),
        });
      }
      lonLines.push(ring);
    }

    let angle = 0;
    let baseAngle = 0;
    let easedScroll = 0;
    let easedTilt = -0.35; // ~ -20deg resting tilt
    let sinT = Math.sin(easedTilt);
    let cosT = Math.cos(easedTilt);

    // scroll "depth": rotates the globe further and tilts it as you descend
    let scrollProgress = 0;
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // colors come straight from the global.css tokens (single source of
    // truth) and re-read on theme change. canvas accepts the hex directly;
    // per-word depth fade uses ctx.globalAlpha, so no rgba string-building.
    let inkColor = '';
    let accentColor = '';
    function readTheme() {
      const cs = getComputedStyle(document.documentElement);
      inkColor = cs.getPropertyValue('--color-ink').trim();
      accentColor = cs.getPropertyValue('--color-accent').trim();
    }
    readTheme();
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    function rotate(p: Vec, a: number): Vec {
      // y-axis rotation, then x-axis tilt
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const x1 = p.x * ca + p.z * sa;
      const z1 = -p.x * sa + p.z * ca;
      const y1 = p.y;
      const y2 = y1 * cosT - z1 * sinT;
      const z2 = y1 * sinT + z1 * cosT;
      return { x: x1, y: y2, z: z2 };
    }

    function project(p: Vec) {
      return { x: cx + p.x * R, y: cy + p.y * R, z: p.z };
    }

    function drawRing(ring: Vec[]) {
      ctx!.beginPath();
      let started = false;
      for (let i = 0; i < ring.length; i++) {
        const r = rotate(ring[i], angle);
        if (r.z < -0.05) {
          started = false;
          continue;
        }
        const pr = project(r);
        if (!started) {
          ctx!.moveTo(pr.x, pr.y);
          started = true;
        } else {
          ctx!.lineTo(pr.x, pr.y);
        }
      }
      ctx!.stroke();
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      // wireframe — accent hue, theme-aware
      ctx!.strokeStyle = accentColor;
      ctx!.lineWidth = 1;
      ctx!.globalAlpha = 0.22;
      latLines.forEach(drawRing);
      lonLines.forEach(drawRing);

      // words — ink, depth-faded via globalAlpha, front hemisphere only
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = inkColor;
      for (const p of pts) {
        const r = rotate(p, angle);
        if (r.z < 0) continue;
        const pr = project(r);
        const depth = (r.z + 1) / 2; // 0..1, front = 1
        const fontSize = 8 + depth * 6; // ~8..14px
        ctx!.globalAlpha = 0.15 + depth * 0.45;
        ctx!.font = `${fontSize}px 'IBM Plex Mono', monospace`;
        ctx!.fillText(p.word, pr.x, pr.y);
      }
      ctx!.globalAlpha = 1;
    }

    let raf = 0;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reduced) {
      draw(); // one static frame, no loop
    } else {
      const loop = () => {
        baseAngle += 0.0018; // slow drift, ~1 revolution / minute
        // ease toward scroll-driven targets so it never snaps
        const targetScroll = scrollProgress * Math.PI * 1.6;
        easedScroll += (targetScroll - easedScroll) * 0.06;
        angle = baseAngle + easedScroll;

        const targetTilt = -0.35 - scrollProgress * 0.28;
        easedTilt += (targetTilt - easedTilt) * 0.06;
        sinT = Math.sin(easedTilt);
        cosT = Math.cos(easedTilt);

        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      themeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} class="globe-canvas" aria-hidden="true" />;
}
