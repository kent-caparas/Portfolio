import { useEffect } from 'preact/hooks';

/**
 * Headless GSAP island. Owns scroll-driven reveals for any element marked
 * `data-reveal`. Renders nothing. Resilient: if GSAP fails to load or the
 * user prefers reduced motion, every reveal element is shown immediately.
 */
export default function ScrollScene() {
  useEffect(() => {
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    );

    const showAll = () => {
      for (const el of reveals) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    };

    // ── HUD scroll "depth" readout — runs regardless of motion preference ──
    const xp = document.getElementById('hud-xp');
    const pct = document.getElementById('hud-pct');
    let ticking = false;
    const updateDepth = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (xp) xp.style.transform = `scaleX(${p.toFixed(4)})`;
      if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0');
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateDepth);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateDepth();

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reduced) {
      showAll();
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }

    const bootEls = document.querySelectorAll('[data-boot]');
    if (reveals.length === 0 && bootEls.length === 0) {
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }

    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
          import('lenis'),
        ]);
        if (cancelled) return;

        gsap.registerPlugin(ScrollTrigger);

        // ── smooth scroll: Lenis driven by GSAP's ticker so ScrollTrigger and
        //    the inertial scroll share one clock (no competing rAF loops). ──
        const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        // In-page anchor links glide instead of jumping. Cross-page links
        // (different pathname) fall through to normal navigation.
        const onAnchorClick = (event: MouseEvent) => {
          const link = (event.target as HTMLElement)?.closest('a');
          const href = link?.getAttribute('href');
          if (!href || !href.includes('#')) return;
          const url = new URL(link!.href, window.location.href);
          if (url.pathname !== window.location.pathname) return;
          const target = document.querySelector(url.hash);
          if (!target) return;
          event.preventDefault();
          lenis.scrollTo(target as HTMLElement);
        };
        document.addEventListener('click', onAnchorClick);

        // ── boot sequence: the hero plays in, then the name glitches once ──
        const bootEls = gsap.utils.toArray<HTMLElement>('[data-boot]');
        if (bootEls.length) {
          gsap.set(bootEls, { opacity: 0, y: 10 });
          const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
          tl.to(bootEls, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 });
          const title = document.querySelector('.title-glitch');
          if (title) {
            tl.add(() => {
              title.classList.add('glitching');
              setTimeout(() => title.classList.remove('glitching'), 560);
            }, '-=0.15');
          }
        }

        let killBatch = () => {};
        if (reveals.length > 0) {
          gsap.set(reveals, { opacity: 0, y: 18 });

          // Batch reveals: elements entering together stagger like dealt cards.
          const batch = ScrollTrigger.batch('[data-reveal]', {
            start: 'top 90%',
            onEnter: (els) =>
              gsap.to(els, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power2.out',
                stagger: 0.06,
                overwrite: true,
              }),
          });

          ScrollTrigger.refresh();

          // failsafe: anything already in view on load reveals immediately,
          // so a section can never get stuck hidden if the batch misses it.
          const vh = window.innerHeight;
          const onload = reveals.filter(
            (el) => el.getBoundingClientRect().top < vh * 0.95,
          );
          if (onload.length) {
            gsap.to(onload, {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              stagger: 0.06,
              overwrite: true,
            });
          }

          killBatch = () => batch.forEach((st) => st.kill());
        }

        cleanup = () => {
          killBatch();
          document.removeEventListener('click', onAnchorClick);
          gsap.ticker.remove(tick);
          lenis.destroy();
        };
      } catch (_) {
        showAll();
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cleanup();
    };
  }, []);

  return null;
}
