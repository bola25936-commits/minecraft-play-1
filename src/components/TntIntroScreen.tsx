import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../game/audio';

interface TntIntroScreenProps {
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shade: string;
  life: number;
  maxLife: number;
  gravity: number;
  kind: 'shard' | 'fire' | 'smoke' | 'spark';
}

interface Shockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

function drawVoxelTntBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  flashWhite: boolean,
  tilt: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  const half = size / 2;
  const depthX = size * 0.22;
  const depthY = -size * 0.18;

  // Drop shadow on ground
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(-half * 0.9, half + 10, size * 1.15, size * 0.14);

  // Top face (angled isometric slab)
  ctx.beginPath();
  ctx.moveTo(-half, -half);
  ctx.lineTo(-half + depthX, -half + depthY);
  ctx.lineTo(half + depthX, -half + depthY);
  ctx.lineTo(half, -half);
  ctx.closePath();
  ctx.fillStyle = flashWhite ? '#ffffff' : '#9b6a44';
  ctx.fill();
  ctx.strokeStyle = flashWhite ? '#ffe8d6' : '#3a2214';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Top gunpowder core grid
  if (!flashWhite) {
    ctx.fillStyle = '#403834';
    ctx.beginPath();
    ctx.moveTo(-half * 0.38, -half + depthY * 0.22);
    ctx.lineTo(-half * 0.38 + depthX * 0.55, -half + depthY * 0.78);
    ctx.lineTo(half * 0.38 + depthX * 0.55, -half + depthY * 0.78);
    ctx.lineTo(half * 0.38, -half + depthY * 0.22);
    ctx.closePath();
    ctx.fill();
  }

  // Fuse cord sticking out top center
  const fuseBaseX = depthX * 0.48;
  const fuseBaseY = -half + depthY * 0.48;
  ctx.strokeStyle = flashWhite ? '#ffd166' : '#d6c3a5';
  ctx.lineWidth = Math.max(4, size * 0.055);
  ctx.beginPath();
  ctx.moveTo(fuseBaseX, fuseBaseY);
  ctx.quadraticCurveTo(fuseBaseX + size * 0.08, fuseBaseY - size * 0.18, fuseBaseX + size * 0.03, fuseBaseY - size * 0.26);
  ctx.stroke();

  // Right side face (3D depth)
  ctx.beginPath();
  ctx.moveTo(half, -half);
  ctx.lineTo(half + depthX, -half + depthY);
  ctx.lineTo(half + depthX, half + depthY);
  ctx.lineTo(half, half);
  ctx.closePath();
  ctx.fillStyle = flashWhite ? '#f0f0f0' : '#8f2018';
  ctx.fill();
  ctx.strokeStyle = flashWhite ? '#e5e5e5' : '#2f0b08';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Right side white band
  ctx.beginPath();
  ctx.moveTo(half, -size * 0.18);
  ctx.lineTo(half + depthX, -size * 0.18 + depthY);
  ctx.lineTo(half + depthX, size * 0.18 + depthY);
  ctx.lineTo(half, size * 0.18);
  ctx.closePath();
  ctx.fillStyle = flashWhite ? '#ffffff' : '#d6d6d6';
  ctx.fill();

  // Front face
  ctx.fillStyle = flashWhite ? '#ffffff' : '#c8362a';
  ctx.fillRect(-half, -half, size, size);

  if (!flashWhite) {
    // Vertical TNT slat stripes top & bottom
    const slats = 6;
    const slatW = size / slats;
    for (let i = 0; i < slats; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#b72d22' : '#d64134';
      ctx.fillRect(-half + i * slatW, -half, slatW, size * 0.31);
      ctx.fillRect(-half + i * slatW, half - size * 0.31, slatW, size * 0.31);
      ctx.fillStyle = '#8b1e16';
      ctx.fillRect(-half + i * slatW, -half, 2, size * 0.31);
      ctx.fillRect(-half + i * slatW, half - size * 0.31, 2, size * 0.31);
    }
  }

  // Front white middle label band
  const bandH = size * 0.38;
  ctx.fillStyle = flashWhite ? '#ffffff' : '#f3f3f3';
  ctx.fillRect(-half, -bandH / 2, size, bandH);

  // Subtle band border lines
  ctx.fillStyle = flashWhite ? '#e5e5e5' : '#231919';
  ctx.fillRect(-half, -bandH / 2, size, 3);
  ctx.fillRect(-half, bandH / 2 - 3, size, 3);

  // Bold blocky TNT text on front band
  ctx.fillStyle = flashWhite ? '#d9483b' : '#121212';
  ctx.font = `900 ${Math.round(size * 0.3)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', 0, 2);

  // Outer crisp pixel border on front face
  ctx.strokeStyle = flashWhite ? '#ffffff' : '#2a0907';
  ctx.lineWidth = 4;
  ctx.strokeRect(-half, -half, size, size);

  ctx.restore();
}

export function TntIntroScreen({ onComplete }: TntIntroScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const [fadingOut, setFadingOut] = useState(false);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const particles: Particle[] = [];
    const shockwaves: Shockwave[] = [];
    let hissPlayed = false;
    let hiss2Played = false;
    let exploded = false;
    let fadeTriggered = false;
    let lastTime = startTime;
    let sparkAccum = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnExplosion = (cx: number, cy: number, blockSize: number) => {
      const shardColors = [
        { color: '#c8362a', shade: '#8d1f16' },
        { color: '#d84537', shade: '#a2271e' },
        { color: '#f3f3f3', shade: '#c5c5c5' },
        { color: '#9b6a44', shade: '#5e3b22' },
        { color: '#262121', shade: '#120f0f' },
      ];

      // Chunky voxel TNT shards flying outward
      for (let i = 0; i < 95; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 220 + Math.random() * 880;
        const pick = shardColors[Math.floor(Math.random() * shardColors.length)];
        particles.push({
          x: cx + (Math.random() - 0.5) * blockSize * 0.65,
          y: cy + (Math.random() - 0.5) * blockSize * 0.65,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 240,
          size: 11 + Math.random() * 24,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 12,
          color: pick.color,
          shade: pick.shade,
          life: 0,
          maxLife: 1.55 + Math.random() * 0.85,
          gravity: 780,
          kind: 'shard',
        });
      }

      // Fireball & glowing ember burst
      const fireColors = ['#ffffff', '#fff3b0', '#ffbe0b', '#fb5607', '#ff3b1f'];
      for (let i = 0; i < 62; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 520;
        particles.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy + (Math.random() - 0.5) * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 75,
          size: 20 + Math.random() * 44,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 5,
          color: fireColors[Math.floor(Math.random() * fireColors.length)],
          shade: '#fb5607',
          life: 0,
          maxLife: 0.75 + Math.random() * 0.6,
          gravity: -95,
          kind: 'fire',
        });
      }

      // Dark chunky smoke puffs lingering after the blast
      for (let i = 0; i < 46; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 270;
        particles.push({
          x: cx + (Math.random() - 0.5) * 65,
          y: cy + (Math.random() - 0.5) * 65,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 85,
          size: 32 + Math.random() * 56,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 2.2,
          color: i % 2 === 0 ? '#474246' : '#2f2b2e',
          shade: '#1c191b',
          life: 0,
          maxLife: 1.6 + Math.random() * 0.85,
          gravity: -60,
          kind: 'smoke',
        });
      }

      shockwaves.push(
        {
          radius: blockSize * 0.35,
          maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.85,
          alpha: 0.95,
          color: '#fff4d2',
          lineWidth: 18,
        },
        {
          radius: blockSize * 0.22,
          maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.68,
          alpha: 0.88,
          color: '#ff6b2b',
          lineWidth: 12,
        },
        {
          radius: blockSize * 0.14,
          maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.5,
          alpha: 0.75,
          color: '#ffd166',
          lineWidth: 8,
        }
      );
    };

    const tick = (now: number) => {
      const elapsedMs = now - startTime;
      const elapsed = elapsedMs / 1000;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h * 0.56;
      const baseBlockSize = Math.max(108, Math.min(168, Math.min(w, h) * 0.24));

      const ENTER_AT = 1.15;
      const FUSE_AT = 2.15;
      const EXPLODE_AT = 4.9;
      const FADE_AT = 6.75;
      const END_AT = 7.6;

      // Trigger audio events at key moments
      if (elapsed >= FUSE_AT && !hissPlayed) {
        hissPlayed = true;
        soundEngine.playHiss();
      }
      if (elapsed >= 3.65 && !hiss2Played) {
        hiss2Played = true;
        soundEngine.playHiss();
      }
      if (elapsed >= EXPLODE_AT && !exploded) {
        exploded = true;
        soundEngine.playExplosion();
        spawnExplosion(cx, cy, baseBlockSize);
      }
      if (elapsed >= FADE_AT && !fadeTriggered) {
        fadeTriggered = true;
        setFadingOut(true);
      }
      if (elapsed >= END_AT) {
        finishIntro();
        return;
      }

      // Compute camera shake
      let shakeX = 0;
      let shakeY = 0;
      if (elapsed < EXPLODE_AT && elapsed > FUSE_AT + 0.35) {
        const preShake = ((elapsed - (FUSE_AT + 0.35)) / (EXPLODE_AT - (FUSE_AT + 0.35))) * 7;
        shakeX = (Math.random() - 0.5) * preShake;
        shakeY = (Math.random() - 0.5) * preShake;
      } else if (elapsed >= EXPLODE_AT) {
        const postT = elapsed - EXPLODE_AT;
        const mag = Math.max(0, 1 - postT / 1.15) * 38;
        shakeX = (Math.random() - 0.5) * mag;
        shakeY = (Math.random() - 0.5) * mag;
      }

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Deep dark background
      const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(w, h) * 0.78);
      if (elapsed >= EXPLODE_AT && elapsed < EXPLODE_AT + 0.55) {
        bgGrad.addColorStop(0, '#5a1e10');
        bgGrad.addColorStop(0.55, '#210b09');
        bgGrad.addColorStop(1, '#090607');
      } else {
        bgGrad.addColorStop(0, '#1e1010');
        bgGrad.addColorStop(0.6, '#100a0c');
        bgGrad.addColorStop(1, '#060507');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle voxel grid background
      ctx.strokeStyle = 'rgba(255, 80, 50, 0.06)';
      ctx.lineWidth = 1;
      const grid = 48;
      for (let gx = (cx % grid) - grid; gx < w; gx += grid) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = (cy % grid) - grid; gy < h; gy += grid) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      ctx.translate(shakeX, shakeY);

      // Stage 1-2: Giant "TNT" Header Banner (shatters / blows away on explosion!)
      const titlePop = Math.min(1, elapsed / 0.55);
      const easeOutBack =
        titlePop < 1
          ? 1 + 2.2 * Math.pow(titlePop - 1, 3) + 1.2 * Math.pow(titlePop - 1, 2)
          : 1;

      if (elapsed < EXPLODE_AT + 0.65) {
        const postBlast = Math.max(0, elapsed - EXPLODE_AT);
        const titleScale =
          elapsed < EXPLODE_AT
            ? easeOutBack
            : 1 + postBlast * 2.2;
        const titleAlpha =
          elapsed < EXPLODE_AT
            ? Math.min(1, elapsed / 0.25)
            : Math.max(0, 1 - postBlast / 0.45);

        const titleY = h * 0.23 - postBlast * 120;
        const fontSize = Math.round(Math.max(64, Math.min(132, w * 0.14)));

        ctx.save();
        ctx.globalAlpha = titleAlpha;
        ctx.translate(cx, titleY);
        ctx.scale(titleScale, titleScale);

        // 3D pixel drop shadow
        ctx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#3b0907';
        ctx.fillText('TNT', 8, 8);
        ctx.fillStyle = '#7f1610';
        ctx.fillText('TNT', 4, 4);

        // Main TNT gradient fill
        const textGrad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
        textGrad.addColorStop(0, '#fff5eb');
        textGrad.addColorStop(0.45, '#ff5940');
        textGrad.addColorStop(1, '#c81d18');
        ctx.fillStyle = textGrad;
        ctx.fillText('TNT', 0, 0);

        // Crisp stroke
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#190505';
        ctx.strokeText('TNT', 0, 0);

        // Subtitle warning label
        const subText =
          elapsed < FUSE_AT
            ? 'INCOMING...'
            : elapsed < 3.6
              ? 'FUSE LIT...'
              : elapsed < EXPLODE_AT
                ? 'PRIMED! STAND BACK!'
                : 'BY BOLA';
        ctx.font = `800 ${Math.round(Math.max(13, fontSize * 0.17))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.fillStyle = elapsed >= FUSE_AT && Math.floor(elapsed * 8) % 2 === 0 ? '#ffd166' : '#fca5a5';
        ctx.fillText(subText, 0, fontSize * 0.56);

        ctx.restore();
      }

      // Stage 2: Incoming TNT Block (flies in, bounces, sparks, flashes white-red, swells & explodes!)
      if (elapsed >= ENTER_AT && elapsed < EXPLODE_AT) {
        const enterT = Math.min(1, (elapsed - ENTER_AT) / 0.95);
        // Bounce easing for vertical drop
        const dropY =
          enterT < 1
            ? -h * 0.58 * Math.pow(1 - enterT, 2) +
              Math.abs(Math.sin(enterT * Math.PI * 2.5)) * (1 - enterT) * -75
            : 0;
        const enterX = (1 - enterT) * w * 0.26;
        const tilt = (1 - enterT) * 0.35 + (elapsed > FUSE_AT + 0.5 ? Math.sin(elapsed * 42) * 0.04 : 0);

        // Classic primed TNT swell + accelerating white flash
        let swell = 1;
        let flashWhite = false;
        if (elapsed >= FUSE_AT) {
          const fuseProgress = (elapsed - FUSE_AT) / (EXPLODE_AT - FUSE_AT);
          // Pulse speed accelerates smoothly from ~2Hz up to ~20Hz
          const phase = fuseProgress * fuseProgress * 22 + fuseProgress * 5;
          flashWhite = Math.sin(phase * Math.PI * 2) > 0;
          // Swells right before detonation
          swell = 1 + Math.pow(fuseProgress, 2.1) * 0.32 + Math.sin(phase * Math.PI * 2) * 0.025;
        }

        const bx = cx + enterX;
        const by = cy + dropY;
        const curSize = baseBlockSize * swell * (0.45 + 0.55 * Math.min(1, enterT * 1.4));

        drawVoxelTntBlock(ctx, bx, by, curSize, flashWhite, tilt);

        // Emit fuse sparks once landed/lit
        if (elapsed >= FUSE_AT - 0.15) {
          sparkAccum += dt * 54;
          while (sparkAccum >= 1) {
            sparkAccum -= 1;
            const fuseTipX = bx + curSize * 0.14;
            const fuseTipY = by - curSize * 0.78;
            particles.push({
              x: fuseTipX,
              y: fuseTipY,
              vx: (Math.random() - 0.5) * 230,
              vy: -95 - Math.random() * 210,
              size: 4 + Math.random() * 6,
              rot: 0,
              vrot: 0,
              color: Math.random() > 0.4 ? '#ffd166' : '#ff5e1a',
              shade: '#ffffff',
              life: 0,
              maxLife: 0.3 + Math.random() * 0.3,
              gravity: 420,
              kind: 'spark',
            });
          }
        }
      }

      // Blast flash & BOOM text right after detonation
      if (elapsed >= EXPLODE_AT) {
        const sinceBlast = elapsed - EXPLODE_AT;

        // Blinding white-orange blast flash
        if (sinceBlast < 0.72) {
          const flashAlpha = Math.max(0, 1 - sinceBlast / 0.72);
          const rad = Math.max(w, h) * (0.38 + sinceBlast * 2.1);
          const blastGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          blastGrad.addColorStop(0, `rgba(255, 255, 240, ${Math.min(1, flashAlpha * 1.15)})`);
          blastGrad.addColorStop(0.35, `rgba(255, 185, 65, ${flashAlpha * 0.85})`);
          blastGrad.addColorStop(0.7, `rgba(235, 64, 32, ${flashAlpha * 0.45})`);
          blastGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = blastGrad;
          ctx.fillRect(-40, -40, w + 80, h + 80);
        }

        // Shockwave rings
        for (const sw of shockwaves) {
          sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 6.0);
          sw.alpha = Math.max(0, sw.alpha - dt * 0.92);
          if (sw.alpha > 0.01) {
            ctx.save();
            ctx.strokeStyle = sw.color;
            ctx.globalAlpha = sw.alpha;
            ctx.lineWidth = sw.lineWidth * sw.alpha;
            ctx.beginPath();
            ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Bold "BY BOLA" finale text after explosion
        if (sinceBlast < 2.25) {
          const finaleScale = 0.75 + Math.min(1, sinceBlast * 3.2) * 0.45;
          const finaleAlpha = sinceBlast < 1.15 ? 1 : Math.max(0, 1 - (sinceBlast - 1.15) / 1.0);
          const finaleSize = Math.round(Math.max(46, Math.min(108, w * 0.11)));
          ctx.save();
          ctx.globalAlpha = finaleAlpha;
          ctx.translate(cx, cy - 18);
          ctx.scale(finaleScale, finaleScale);
          ctx.font = `900 ${finaleSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#3b0907';
          ctx.fillText('BY BOLA', 7, 7);
          ctx.fillStyle = '#fff3b0';
          ctx.fillText('BY BOLA', 0, 0);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ff4d1c';
          ctx.strokeText('BY BOLA', 0, 0);
          ctx.restore();
        }
      }

      // Update & draw all particles (sparks, shards, fireballs, smoke)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        // Slight drag on fire/smoke
        if (p.kind === 'fire' || p.kind === 'smoke') {
          p.vx *= Math.pow(0.25, dt);
          p.vy *= Math.pow(0.35, dt);
        }

        const lifeRatio = p.life / p.maxLife;
        const alpha = p.kind === 'smoke' ? (1 - lifeRatio) * 0.65 : 1 - Math.pow(lifeRatio, 1.8);

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        if (p.kind === 'shard') {
          // 2-tone voxel cube shard
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.fillStyle = p.shade;
          ctx.fillRect(-p.size / 2, p.size * 0.12, p.size, p.size * 0.38);
        } else if (p.kind === 'spark') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          const s = p.size * (1 + lifeRatio * 0.45);
          ctx.fillStyle = p.color;
          ctx.fillRect(-s / 2, -s / 2, s, s);
        }
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlockAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    soundEngine.playHiss();
  };

  return (
    <div
      onPointerDown={handleUnlockAudio}
      className={`fixed inset-0 z-50 select-none overflow-hidden bg-[#090607] transition-opacity duration-500 ${
        fadingOut ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="pointer-events-none fixed inset-x-0 bottom-5 flex items-center justify-between px-6">
        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-200/50">
          Tap anywhere for sound
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            finishIntro();
          }}
          className="pointer-events-auto rounded-none border-2 border-white/25 bg-black/75 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-white transition hover:border-amber-400 hover:bg-amber-500 hover:text-slate-950"
        >
          Skip Intro
        </button>
      </div>
    </div>
  );
}
