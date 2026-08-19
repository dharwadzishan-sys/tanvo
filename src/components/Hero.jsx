import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles, Terminal } from 'lucide-react';
import Logo from './Logo';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ROTATING_WORDS = [
  'Web Development',
  'App Development',
  'AI Solutions',
  'Digital Automations',
];

const HIGHLIGHTS = [
  { title: 'MERN stack focus', desc: 'Robust, scalable web builds' },
  { title: 'AI-driven automation', desc: 'Automate complex business flows' },
  { title: 'App development', desc: 'Multi-platform responsive apps' },
  { title: 'Digital growth', desc: 'Expert search & marketing engine' },
];

/**
 * Interactive particle field.
 *
 * Reworked from the original for correctness and cost:
 *   - scales the backing store by devicePixelRatio (was blurry on every
 *     retina display) while keeping CSS size in logical pixels
 *   - compares squared distances, dropping ~1,700 sqrt calls per frame
 *   - pauses entirely when scrolled out of view or the tab is hidden,
 *     instead of running a 60fps loop for the life of the page
 *   - respects prefers-reduced-motion by drawing one static frame
 *   - uses ResizeObserver on the container and repositions particles
 *     that fall outside the new bounds
 */
function useParticleField(canvasRef, containerRef, disabled) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const LINK_DISTANCE = 110;
    const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;
    const MOUSE_RADIUS = 150;

    let width = 0;
    let height = 0;
    let particles = [];
    let frame = null;
    let inView = true;
    const mouse = { x: null, y: null };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Pull any particle now outside the viewport back into bounds.
      particles.forEach((p) => {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      });
    };

    const seed = () => {
      const target = Math.min(60, Math.floor((width * height) / 18000));
      particles = Array.from({ length: Math.max(12, target) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1,
        warm: Math.random() > 0.5,
      }));
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx = -p.vx;
        if (p.y < 0 || p.y > height) p.vy = -p.vy;

        if (mouse.x !== null) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MOUSE_RADIUS * MOUSE_RADIUS && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            p.x += (dx / dist) * force * 1.5;
            p.y += (dy / dist) * force * 1.5;
          }
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.warm ? 'rgb(0 242 254 / 0.25)' : 'rgb(0 114 255 / 0.25)';
        ctx.fill();
      }

      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= LINK_DISTANCE_SQ) continue;

          const alpha = (1 - Math.sqrt(distSq) / LINK_DISTANCE) * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgb(0 242 254 / ${alpha})`;
          ctx.stroke();
        }
      }
    };

    const loop = () => {
      step();
      draw();
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (frame === null && inView && !document.hidden) frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    };

    resize();
    seed();

    if (disabled) {
      // Reduced motion: one static frame, no loop at all.
      draw();
      return () => {};
    }

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };
    const handlePointerLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    const handleVisibility = () => (document.hidden ? stop() : start());

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (frame === null) draw();
    });
    resizeObserver.observe(container);

    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0 },
    );
    viewObserver.observe(container);

    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      viewObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [canvasRef, containerRef, disabled]);
}

export default function Hero() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [wordIndex, setWordIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useParticleField(canvasRef, containerRef, prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const id = setInterval(
      () => setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length),
      2800,
    );
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  return (
    <section
      ref={containerRef}
      id="home"
      aria-labelledby="hero-heading"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden pt-32 pb-20"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      />

      <div className="glow-blob animate-pulse-glow left-[-10%] top-[20%] h-[400px] w-[400px] bg-cyan-500/10" />
      <div
        className="glow-blob animate-pulse-glow bottom-[10%] right-[-10%] h-[500px] w-[500px] bg-blue-500/10"
        style={{ animationDelay: '2s' }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-50 bg-[linear-gradient(rgb(255_255_255/0.015)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.015)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      {/* Oversized brand mark as a centered background texture. Barely-there by
          design — it should register as depth, not as a second logo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[min(90vw,900px)] w-[min(90vw,900px)] -translate-x-1/2 -translate-y-1/2 opacity-20 mix-blend-screen animate-drift"
      >
        <Logo className="h-full w-full" showText={false} />
      </div>

      <div className="container-page relative z-10 text-center">
        <div className="animate-drift mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-400 md:text-sm">
          <Sparkles size={14} aria-hidden="true" />
          <span>Innovating digital architectures</span>
        </div>

        <h1
          id="hero-heading"
          /* No 2xl step: the root font size already scales this up on
             large displays, and stacking both broke "Next-Gen" onto
             two lines. */
          className="mb-6 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl xl:text-8xl"
        >
          Engineering Next-Gen <br />
          <span className="gradient-text">Digital Futures</span>
        </h1>

        {/*
          The rotator is decorative repetition for sighted users. Screen
          readers get the full list once, as a normal sentence, instead of
          a value that mutates every 2.8 seconds.
        */}
        <p className="sr-only">
          Specialised in {ROTATING_WORDS.slice(0, -1).join(', ')} and{' '}
          {ROTATING_WORDS.at(-1)}.
        </p>

        <div
          aria-hidden="true"
          className="mb-8 flex h-12 items-center justify-center overflow-hidden md:h-16 xl:h-20"
        >
          <div className="flex items-center gap-2 text-xl font-medium tracking-wide text-slate-300 md:text-3xl xl:text-4xl">
            <span>Specialised in</span>
            <span className="relative inline-block h-[1.4em] w-[240px] overflow-hidden border-l-2 border-cyan-400/50 pl-3 text-left font-bold text-cyan-400 md:w-[380px] xl:w-[500px]">
              {ROTATING_WORDS.map((word, index) => (
                <span
                  key={word}
                  className={`absolute left-3 top-0 transition-all duration-700 ease-in-out ${
                    index === wordIndex
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-full opacity-0'
                  }`}
                >
                  {word}
                </span>
              ))}
            </span>
          </div>
        </div>

        {/* Kept to a readable measure even as the container grows. */}
        <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg xl:max-w-3xl xl:text-xl">
          At <strong className="font-medium text-white">Tanvo Tech</strong>, we craft
          high-performance web applications, robust mobile platforms, bespoke AI
          integrations, and seamless digital automations designed to scale your business.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a href="#portfolio" className="btn-primary">
            Explore our work <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a href="#contact" className="btn-secondary">
            <Terminal size={18} className="text-cyan-400" aria-hidden="true" />
            Get a tech recommendation
          </a>
        </div>

        <ul className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 border-t border-white/5 pt-10 text-left md:grid-cols-4 xl:max-w-6xl xl:gap-10">
          {HIGHLIGHTS.map((item) => (
            <li
              key={item.title}
              className="border-l border-cyan-500/20 p-4 transition-colors hover:border-cyan-400"
            >
              <h2 className="mb-1 font-heading text-sm font-bold uppercase tracking-wider text-white">
                {item.title}
              </h2>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
