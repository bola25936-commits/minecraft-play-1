import React, { useEffect, useRef } from 'react';

interface MenuFireBackdropProps {
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

const FLAME_PALETTE = [
  '#450a0a',
  '#7f1d1d',
  '#b91c1c',
  '#dc2626',
  '#ea580c',
  '#f97316',
  '#f59e0b',
  '#fbbf24',
  '#fde047',
  '#fef9c3',
];

const EMBER_COLORS = ['#fef08a', '#fde047', '#fbbf24', '#fb923c', '#f97316', '#ef4444'];

function pseudoNoise(x: number, t: number): number {
  return (
    Math.sin(x * 0.13 + t * 4.2) * 0.45 +
    Math.sin(x * 0.31 - t * 6.7) * 0.35 +
    Math.cos(x * 0.57 + t * 9.3) * 0.2
  );
}

export const MenuFireBackdrop: React.FC<MenuFireBackdropProps> = ({ cardRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    const embers: Ember[] = [];
    let emberSpawnAccum = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawPixelFlameStrip = (
      x0: number,
      y0: number,
      length: number,
      maxReach: number,
      cell: number,
      dir: 'up' | 'down' | 'left' | 'right',
      t: number,
      seedOffset: number
    ) => {
      const steps = Math.ceil(length / cell);
      for (let i = 0; i < steps; i++) {
        const pos = i * cell;
        const n = (pseudoNoise(i * 1.4 + seedOffset, t) + 1) * 0.5;
        const reach = maxReach * (0.35 + n * 0.72);
        const layers = Math.max(1, Math.floor(reach / cell));

        for (let l = 0; l < layers; l++) {
          const progress = l / Math.max(1, layers);
          if (progress > 0.65 && (i * 17 + l * 31 + Math.floor(t * 14)) % 5 === 0) {
            continue;
          }
          const colorIdx = Math.max(
            0,
            Math.min(
              FLAME_PALETTE.length - 1,
              Math.floor((1 - progress * 0.88) * (FLAME_PALETTE.length - 1))
            )
          );
          ctx.fillStyle = FLAME_PALETTE[colorIdx];

          let px = x0;
          let py = y0;
          const dist = l * cell;
          if (dir === 'up') {
            px = x0 + pos;
            py = y0 - dist - cell;
          } else if (dir === 'down') {
            px = x0 + pos;
            py = y0 + dist;
          } else if (dir === 'left') {
            px = x0 - dist - cell;
            py = y0 + pos;
          } else {
            px = x0 + dist;
            py = y0 + pos;
          }
          ctx.fillRect(px, py, cell, cell);
        }
      }
    };

    const spawnEmber = (x: number, y: number, speedScale = 1) => {
      embers.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 44 * speedScale,
        vy: (-55 - Math.random() * 115) * speedScale,
        size: 3 + Math.floor(Math.random() * 5),
        life: 0,
        maxLife: 1.4 + Math.random() * 1.8,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
      });
    };

    const renderFrame = (now: number) => {
      const t = (now - startTime) / 1000;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Warm flickering inferno edge glow
      const flicker = 0.88 + Math.sin(t * 9.5) * 0.07 + Math.cos(t * 15.3) * 0.05;

      const bottomGlow = ctx.createLinearGradient(0, h, 0, h - 240);
      bottomGlow.addColorStop(0, `rgba(234, 88, 12, ${0.52 * flicker})`);
      bottomGlow.addColorStop(0.45, `rgba(185, 28, 28, ${0.24 * flicker})`);
      bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bottomGlow;
      ctx.fillRect(0, h - 240, w, 240);

      const leftGlow = ctx.createLinearGradient(0, 0, 150, 0);
      leftGlow.addColorStop(0, `rgba(220, 38, 38, ${0.38 * flicker})`);
      leftGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, 150, h);

      const rightGlow = ctx.createLinearGradient(w, 0, w - 150, 0);
      rightGlow.addColorStop(0, `rgba(220, 38, 38, ${0.38 * flicker})`);
      rightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightGlow;
      ctx.fillRect(w - 150, 0, 150, h);

      const rect = cardRef?.current?.getBoundingClientRect();

      // Radial fire aura behind the center Menu Card
      if (rect && rect.width > 0 && rect.height > 0) {
        const cardCx = rect.left + rect.width / 2;
        const cardCy = rect.top + rect.height / 2;
        const auraRadius = Math.max(rect.width, rect.height) * 0.85;
        const cardGlow = ctx.createRadialGradient(
          cardCx,
          cardCy,
          Math.min(rect.width, rect.height) * 0.25,
          cardCx,
          cardCy,
          auraRadius
        );
        cardGlow.addColorStop(0, `rgba(249, 115, 22, ${0.42 * flicker})`);
        cardGlow.addColorStop(0.55, `rgba(185, 28, 28, ${0.22 * flicker})`);
        cardGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cardGlow;
        ctx.fillRect(
          cardCx - auraRadius,
          cardCy - auraRadius,
          auraRadius * 2,
          auraRadius * 2
        );

        // Pixel fire licking outward around all 4 edges of the Menu Card
        const cardCell = 8;
        drawPixelFlameStrip(rect.left + 8, rect.top, rect.width - 16, 44, cardCell, 'up', t, 11);
        drawPixelFlameStrip(rect.left + 8, rect.bottom, rect.width - 16, 36, cardCell, 'down', t, 29);
        drawPixelFlameStrip(rect.left, rect.top + 8, rect.height - 16, 38, cardCell, 'left', t, 47);
        drawPixelFlameStrip(rect.right, rect.top + 8, rect.height - 16, 38, cardCell, 'right', t, 63);
      }

      // Roaring pixel fire along bottom & side edges of the viewport
      const edgeCell = 12;
      drawPixelFlameStrip(0, h, w, 108, edgeCell, 'up', t, 3);
      drawPixelFlameStrip(0, h * 0.22, h * 0.78, 62, edgeCell, 'right', t, 19);
      drawPixelFlameStrip(w, h * 0.22, h * 0.78, 62, edgeCell, 'left', t, 37);

      // Spawn and animate rising embers around both the screen and Menu Card
      if (!prefersReducedMotion) {
        emberSpawnAccum += dt * 42;
        while (emberSpawnAccum >= 1) {
          emberSpawnAccum -= 1;
          if (rect && Math.random() < 0.55) {
            const side = Math.floor(Math.random() * 3);
            if (side === 0) {
              spawnEmber(rect.left + Math.random() * rect.width, rect.top - 4, 0.9);
            } else if (side === 1) {
              spawnEmber(rect.left - 8, rect.top + Math.random() * rect.height, 0.95);
            } else {
              spawnEmber(rect.right + 8, rect.top + Math.random() * rect.height, 0.95);
            }
          } else {
            spawnEmber(Math.random() * w, h - 8, 1.15);
          }
        }

        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i];
          e.life += dt;
          if (e.life >= e.maxLife || e.y < -20) {
            embers.splice(i, 1);
            continue;
          }
          e.vx += Math.sin(t * 7 + i) * 35 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;

          const alpha = Math.max(0, 1 - Math.pow(e.life / e.maxLife, 1.4));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
          ctx.restore();
        }
      }

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [cardRef]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden="true" />;
};
