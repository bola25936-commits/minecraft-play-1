import React, { useEffect, useRef } from 'react';
import { BehaviorPackId, MarketplaceBundleItem } from '../game/marketplace';
import { PlayerSkin } from '../game/skins';
import { TexturePackId } from '../game/textures';

interface ResourceScenePalette {
  skyTop: string;
  skyBottom: string;
  sunColor: string;
  cloudColor: string;
  grassTop: string;
  grassSide: string;
  dirt: string;
  dirtShade: string;
  stone: string;
  stoneShade: string;
  oreColor: string;
  wood: string;
  leaves: string;
  leavesHighlight: string;
  waterTop: string;
  waterSide: string;
  gridOverlay?: string;
  particleColor?: string;
  particleKind?: 'snow' | 'ember' | 'sparkle' | 'cyber' | 'none';
}

const RESOURCE_PALETTES: Record<TexturePackId, ResourceScenePalette> = {
  pbr: {
    skyTop: '#2563eb',
    skyBottom: '#93c5fd',
    sunColor: '#fef08a',
    cloudColor: 'rgba(255,255,255,0.85)',
    grassTop: '#63b83c',
    grassSide: '#4a942b',
    dirt: '#7d5535',
    dirtShade: '#5d3e25',
    stone: '#80848a',
    stoneShade: '#5e6268',
    oreColor: '#3be0eb',
    wood: '#6b4728',
    leaves: '#3d8229',
    leavesHighlight: '#67be47',
    waterTop: '#38bdf8',
    waterSide: '#0284c7',
    particleKind: 'sparkle',
    particleColor: '#fef9c3',
  },
  square: {
    skyTop: '#38bdf8',
    skyBottom: '#bae6fd',
    sunColor: '#facc15',
    cloudColor: '#ffffff',
    grassTop: '#68c33f',
    grassSide: '#4d9b2d',
    dirt: '#865b38',
    dirtShade: '#664327',
    stone: '#94a3b8',
    stoneShade: '#64748b',
    oreColor: '#facc15',
    wood: '#78502c',
    leaves: '#2f7d24',
    leavesHighlight: '#55ad39',
    waterTop: '#3b82f6',
    waterSide: '#1d4ed8',
    gridOverlay: 'rgba(0,0,0,0.16)',
    particleKind: 'none',
  },
  neon_cyber: {
    skyTop: '#090418',
    skyBottom: '#2e1065',
    sunColor: '#ec4899',
    cloudColor: 'rgba(6, 182, 212, 0.35)',
    grassTop: '#00f5d4',
    grassSide: '#06b6d4',
    dirt: '#1e1b4b',
    dirtShade: '#0f172a',
    stone: '#1e293b',
    stoneShade: '#090d16',
    oreColor: '#f472b6',
    wood: '#6d28d9',
    leaves: '#0891b2',
    leavesHighlight: '#22d3ee',
    waterTop: '#00f5d4',
    waterSide: '#0284c7',
    gridOverlay: 'rgba(0, 245, 212, 0.36)',
    particleKind: 'cyber',
    particleColor: '#22d3ee',
  },
  candy_pastel: {
    skyTop: '#f9a8d4',
    skyBottom: '#fde68a',
    sunColor: '#fffbeb',
    cloudColor: 'rgba(255,255,255,0.92)',
    grassTop: '#7bf1a8',
    grassSide: '#4ade80',
    dirt: '#f9a8d4',
    dirtShade: '#ec4899',
    stone: '#fbcfe8',
    stoneShade: '#f472b6',
    oreColor: '#fef08a',
    wood: '#f472b6',
    leaves: '#a7f3d0',
    leavesHighlight: '#fbcfe8',
    waterTop: '#67e8f9',
    waterSide: '#22d3ee',
    particleKind: 'sparkle',
    particleColor: '#ffffff',
  },
  golden_royal: {
    skyTop: '#78350f',
    skyBottom: '#fcd34d',
    sunColor: '#fffbeb',
    cloudColor: 'rgba(254, 243, 199, 0.72)',
    grassTop: '#84cc16',
    grassSide: '#65a30d',
    dirt: '#b45309',
    dirtShade: '#78350f',
    stone: '#fde68a',
    stoneShade: '#d97706',
    oreColor: '#fef08a',
    wood: '#92400e',
    leaves: '#65a30d',
    leavesHighlight: '#eab308',
    waterTop: '#3b82f6',
    waterSide: '#1d4ed8',
    particleKind: 'sparkle',
    particleColor: '#fde047',
  },
  crimson_nether: {
    skyTop: '#1a0505',
    skyBottom: '#7f1d1d',
    sunColor: '#fb923c',
    cloudColor: 'rgba(239, 68, 68, 0.3)',
    grassTop: '#dc2626',
    grassSide: '#991b1b',
    dirt: '#451a1a',
    dirtShade: '#2a0e0e',
    stone: '#572424',
    stoneShade: '#361313',
    oreColor: '#fb923c',
    wood: '#6b2016',
    leaves: '#b91c1c',
    leavesHighlight: '#f97316',
    waterTop: '#f97316',
    waterSide: '#c2410c',
    particleKind: 'ember',
    particleColor: '#fb923c',
  },
  frost_tundra: {
    skyTop: '#0c4a6e',
    skyBottom: '#bae6fd',
    sunColor: '#e0f2fe',
    cloudColor: 'rgba(240, 249, 255, 0.88)',
    grassTop: '#e0f2fe',
    grassSide: '#7dd3fc',
    dirt: '#475569',
    dirtShade: '#334155',
    stone: '#93c5fd',
    stoneShade: '#0284c7',
    oreColor: '#67e8f9',
    wood: '#64748b',
    leaves: '#7dd3fc',
    leavesHighlight: '#f0f9ff',
    waterTop: '#38bdf8',
    waterSide: '#0369a1',
    particleKind: 'snow',
    particleColor: '#ffffff',
  },
  noir_emerald: {
    skyTop: '#09090b',
    skyBottom: '#3f3f46',
    sunColor: '#f4f4f5',
    cloudColor: 'rgba(228, 228, 231, 0.35)',
    grassTop: '#10b981',
    grassSide: '#059669',
    dirt: '#52525b',
    dirtShade: '#27272a',
    stone: '#a1a1aa',
    stoneShade: '#52525b',
    oreColor: '#34d399',
    wood: '#3f3f46',
    leaves: '#10b981',
    leavesHighlight: '#6ee7b7',
    waterTop: '#10b981',
    waterSide: '#047857',
    gridOverlay: 'rgba(255,255,255,0.12)',
    particleKind: 'sparkle',
    particleColor: '#34d399',
  },
};

function drawIsoBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  topCol: string,
  leftCol: string,
  rightCol: string,
  bandCol?: string,
  gridOverlay?: string,
  oreColor?: string
) {
  const hw = w * 0.5;
  const hh = w * 0.27;

  // Top diamond face
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = topCol;
  ctx.fill();
  if (gridOverlay) {
    ctx.strokeStyle = gridOverlay;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh + h);
  ctx.lineTo(cx - hw, cy + h);
  ctx.closePath();
  ctx.fillStyle = leftCol;
  ctx.fill();

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh + h);
  ctx.lineTo(cx + hw, cy + h);
  ctx.closePath();
  ctx.fillStyle = rightCol;
  ctx.fill();

  // Grass overhang band on top of side faces
  if (bandCol) {
    const bh = h * 0.26;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + bh);
    ctx.lineTo(cx - hw, cy + bh);
    ctx.closePath();
    ctx.fillStyle = bandCol;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + bh);
    ctx.lineTo(cx + hw, cy + bh);
    ctx.closePath();
    ctx.fillStyle = bandCol;
    ctx.fill();
  }

  // Glowing ore flecks
  if (oreColor) {
    ctx.fillStyle = oreColor;
    ctx.fillRect(cx - hw * 0.58, cy + h * 0.38, 4, 4);
    ctx.fillRect(cx - hw * 0.28, cy + h * 0.62, 4, 3);
    ctx.fillRect(cx + hw * 0.34, cy + h * 0.44, 4, 4);
  }

  if (gridOverlay) {
    ctx.strokeStyle = gridOverlay;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx + hw, cy);
    ctx.moveTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + h);
    ctx.stroke();
  }
}

export const ResourcePackShowcaseCanvas: React.FC<{
  packId: TexturePackId;
  animated?: boolean;
  className?: string;
}> = ({ packId, animated = false, className = 'h-24 w-full' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const parent = canvas.parentElement;
      const w = Math.max(120, parent ? parent.clientWidth : 280);
      const h = Math.max(64, parent ? parent.clientHeight : 96);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const p = RESOURCE_PALETTES[packId];
      const t = animated ? (now - start) / 1000 : 0.4;

      // Sky background
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, p.skyTop);
      sky.addColorStop(1, p.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Cyber horizon grid lines if neon_cyber
      if (packId === 'neon_cyber') {
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.28)';
        ctx.lineWidth = 1;
        for (let gy = h * 0.45; gy < h; gy += 10) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }
        for (let gx = 0; gx < w; gx += 22) {
          ctx.beginPath();
          ctx.moveTo(gx, h * 0.45);
          ctx.lineTo(gx + (gx - w * 0.5) * 0.6, h);
          ctx.stroke();
        }
      }

      // Sun / Moon pixel disc
      const sunX = w * 0.82;
      const sunY = h * 0.24;
      const sunSz = animated ? 14 + Math.sin(t * 2) * 1 : 14;
      ctx.fillStyle = p.sunColor;
      ctx.fillRect(sunX - sunSz / 2, sunY - sunSz / 2, sunSz, sunSz);

      // Drifting blocky clouds
      const cOffset = animated ? (t * 14) % (w + 60) : 0;
      ctx.fillStyle = p.cloudColor;
      const c1x = ((w * 0.16 + cOffset) % (w + 60)) - 30;
      const c2x = ((w * 0.56 + cOffset * 0.7) % (w + 60)) - 30;
      ctx.fillRect(c1x, h * 0.14, 34, 8);
      ctx.fillRect(c1x + 8, h * 0.1, 18, 5);
      ctx.fillRect(c2x, h * 0.2, 26, 7);

      // Distant voxel hill silhouette
      ctx.fillStyle = p.dirtShade;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, h * 0.68, w * 0.36, h * 0.32);
      ctx.fillRect(w * 0.64, h * 0.62, w * 0.36, h * 0.38);
      ctx.globalAlpha = 1;

      // Isometric 3D Voxel Diorama (stepped blocks + ore + water + tree)
      const scale = Math.min(w / 240, h / 95);
      const bw = 34 * scale;
      const bh = 22 * scale;
      const baseX = w * 0.48;
      const baseY = h * 0.58;
      const dx = bw * 0.5;
      const dy = bw * 0.27;

      // Back row: Stone + Ore block & Grass hill
      drawIsoBlock(ctx, baseX - dx, baseY - dy - bh * 0.4, bw, bh, p.stone, p.stone, p.stoneShade, undefined, p.gridOverlay, p.oreColor);
      drawIsoBlock(ctx, baseX + dx, baseY - dy, bw, bh, p.grassTop, p.dirt, p.dirtShade, p.grassSide, p.gridOverlay);

      // Mid row: Water block + Central Grass block
      drawIsoBlock(ctx, baseX - dx * 2, baseY, bw, bh, p.grassTop, p.dirt, p.dirtShade, p.grassSide, p.gridOverlay);
      drawIsoBlock(ctx, baseX, baseY, bw, bh, p.grassTop, p.dirt, p.dirtShade, p.grassSide, p.gridOverlay);
      drawIsoBlock(
        ctx,
        baseX + dx * 2,
        baseY + (animated ? Math.sin(t * 3) * 1.2 : 0),
        bw,
        bh * 0.85,
        p.waterTop,
        p.waterSide,
        p.waterSide,
        undefined,
        p.gridOverlay
      );

      // Front lower block showing dirt & stone strata
      drawIsoBlock(ctx, baseX - dx, baseY + dy + bh * 0.35, bw, bh, p.grassTop, p.dirt, p.dirtShade, p.grassSide, p.gridOverlay);
      drawIsoBlock(ctx, baseX + dx, baseY + dy + bh * 0.35, bw, bh, p.stone, p.stone, p.stoneShade, undefined, p.gridOverlay, p.oreColor);

      // Voxel Tree on the upper right grass block
      const treeX = baseX + dx;
      const treeBaseY = baseY - dy - 2 * scale;
      ctx.fillStyle = p.wood;
      ctx.fillRect(treeX - 3 * scale, treeBaseY - 18 * scale, 6 * scale, 18 * scale);
      ctx.fillStyle = p.leaves;
      ctx.fillRect(treeX - 13 * scale, treeBaseY - 32 * scale, 26 * scale, 15 * scale);
      ctx.fillStyle = p.leavesHighlight;
      ctx.fillRect(treeX - 9 * scale, treeBaseY - 38 * scale, 18 * scale, 8 * scale);

      // Ambient particles (snow, embers, cyber sparks, sparkles)
      if (p.particleKind && p.particleKind !== 'none' && p.particleColor) {
        ctx.fillStyle = p.particleColor;
        const count = animated ? 18 : 9;
        for (let i = 0; i < count; i++) {
          const seed = i * 47.3;
          let px = ((seed * 19 + (animated ? t * (16 + (i % 5) * 6) : 0)) % (w - 8)) + 4;
          let py = (seed * 31) % (h - 8);
          if (p.particleKind === 'ember' && animated) {
            py = h - ((seed * 11 + t * 32) % h);
          } else if (p.particleKind === 'snow' && animated) {
            py = (seed * 11 + t * 28) % h;
            px = (seed * 19 + Math.sin(t * 2 + i) * 12) % w;
          } else if (animated) {
            py = (seed * 23 + Math.sin(t * 3 + i) * 6) % h;
          }
          const sz = (i % 2) + 2;
          ctx.globalAlpha = animated ? 0.55 + 0.45 * Math.sin(t * 5 + i) : 0.75;
          ctx.fillRect(Math.round(px), Math.round(py), sz, sz);
        }
        ctx.globalAlpha = 1;
      }

      if (animated) {
        rafId = requestAnimationFrame(draw);
      }
    };

    if (animated) {
      rafId = requestAnimationFrame(draw);
    } else {
      draw(start);
    }

    const onResize = () => draw(performance.now());
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [packId, animated]);

  return <canvas ref={canvasRef} className={`block ${className}`} aria-hidden="true" />;
};

export const BehaviorPackArtwork: React.FC<{ packId: BehaviorPackId }> = ({ packId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const w = Math.max(120, parent ? parent.clientWidth : 260);
    const h = 68;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich themed background per ability
    const bgMap: Record<BehaviorPackId, [string, string]> = {
      lunar_gravity: ['#13092b', '#3b0764'],
      hyper_sprint: ['#042f2e', '#0e7490'],
      peaceful_aura: ['#052e16', '#065f46'],
      titan_haste: ['#291d05', '#78350f'],
      titan_strength: ['#2b0909', '#7f1d1d'],
      vampiric_regen: ['#2a0616', '#881337'],
      double_loot: ['#0c1c3a', '#1d4ed8'],
      mega_tnt: ['#270c06', '#9a3412'],
    };
    const [topC, botC] = bgMap[packId];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, topC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle voxel grid texture
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const cx = w * 0.5;
    const cy = h * 0.5;

    if (packId === 'lunar_gravity') {
      // Stars + moon craters + high-jumping voxel figure
      ctx.fillStyle = '#e9d5ff';
      for (let i = 0; i < 14; i++) ctx.fillRect((i * 43) % w, (i * 19) % 45, 2, 2);
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(0, h - 14, w, 14);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(cx - 28, h - 16, 18, 4);
      ctx.fillRect(cx + 12, h - 15, 22, 3);
      // Floating player leaping
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - 6, 12, 12, 12);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 4, 15, 8, 5);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(cx - 5, 24, 10, 12);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.fillRect(cx - 3, 40, 6, 10);
    } else if (packId === 'hyper_sprint') {
      // Grass strip + glowing cyan wind trails + speed boot
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, h - 12, w, 12);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(16, 22, cx - 22, 4);
      ctx.fillRect(30, 32, cx - 26, 3);
      ctx.fillRect(10, 42, cx - 18, 4);
      // Pixel lightning boot
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(cx - 4, 16, 18, 22);
      ctx.fillRect(cx - 4, 34, 28, 10);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx + 16, 18, 8, 6);
      ctx.fillRect(cx + 12, 24, 8, 6);
    } else if (packId === 'peaceful_aura') {
      // Glowing shield + warm golden heart + green grass
      ctx.fillStyle = '#166534';
      ctx.fillRect(0, h - 12, w, 12);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 28, 10, 56, 46);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
      ctx.fillRect(cx - 28, 10, 56, 46);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(cx - 10, 22, 20, 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 4, 27, 8, 8);
    } else if (packId === 'titan_haste') {
      // Diamond Pickaxe smashing glowing diamond ore block
      drawIsoBlock(ctx, cx + 18, 30, 30, 18, '#64748b', '#475569', '#334155', undefined, undefined, '#38bdf8');
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 26, 16, 22, 6);
      ctx.fillRect(cx - 10, 16, 6, 24);
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(cx - 24, 22, 5, 28);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 4, 22, 5, 5);
      ctx.fillRect(cx + 2, 12, 4, 4);
    } else if (packId === 'titan_strength') {
      // Crimson/Steel Sword + radiant slash shockwave
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + 6, cy, 24, -1.1, 1.1);
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - 6, 10, 8, 32);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 14, 38, 24, 5);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 4, 43, 4, 12);
    } else if (packId === 'vampiric_regen') {
      // Big ruby voxel heart + rising golden healing crosses
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(cx - 14, 20, 12, 12);
      ctx.fillRect(cx + 2, 20, 12, 12);
      ctx.fillRect(cx - 14, 28, 28, 12);
      ctx.fillRect(cx - 9, 40, 18, 8);
      ctx.fillRect(cx - 4, 48, 8, 6);
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(cx - 10, 23, 5, 5);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 32, 20, 8, 3);
      ctx.fillRect(cx - 29.5, 17.5, 3, 8);
      ctx.fillRect(cx + 24, 24, 8, 3);
      ctx.fillRect(cx + 26.5, 21.5, 3, 8);
    } else if (packId === 'double_loot') {
      // Treasure chest bursting with 2x Diamond & Gold gems
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(cx - 20, 30, 40, 24);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 20, 28, 40, 5);
      ctx.fillRect(cx - 4, 30, 8, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 16, 14, 10, 10);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(cx + 6, 14, 10, 10);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 4, 10, 8, 10);
    } else if (packId === 'mega_tnt') {
      // Explosive TNT block + orange blast burst
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(cx - 30, 12, 60, 44);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 22, 18, 44, 32);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(cx - 14, 20, 28, 28);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - 14, 29, 28, 10);
      ctx.fillStyle = '#111827';
      ctx.font = '900 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TNT', cx, 34);
    }
  }, [packId]);

  return <canvas ref={canvasRef} className="block h-[68px] w-full border-b border-white/10" aria-hidden="true" />;
};

export const SkinFullShowcase: React.FC<{ skin: PlayerSkin; accentColor: string }> = ({
  skin,
  accentColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 72;
    const h = 84;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;

    // Glowing dark showcase pedestal
    const bg = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.45, 44);
    bg.addColorStop(0, `${accentColor}44`);
    bg.addColorStop(1, '#090d14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Ground pedestal shadow
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(14, 72, 44, 6);
    ctx.fillStyle = `${accentColor}66`;
    ctx.fillRect(16, 73, 40, 2);

    const px = 2.2;
    // Draw 8x8 head centered at x=27..45, y=6..24
    const paintGrid = (
      grid: string[],
      cols: number,
      rows: number,
      ox: number,
      oy: number
    ) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const color = grid[r * cols + c] ?? '#1f2937';
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(ox + c * px), Math.round(oy + r * px), Math.ceil(px), Math.ceil(px));
        }
      }
    };

    const headX = w / 2 - 4 * px;
    const torsoX = w / 2 - 4 * px;
    paintGrid(skin.head, 8, 8, headX, 8);
    paintGrid(skin.torso, 8, 8, torsoX, 8 + 8 * px + 1);
    paintGrid(skin.arm, 4, 8, torsoX - 4 * px - 1, 8 + 8 * px + 1);
    paintGrid(skin.arm, 4, 8, torsoX + 8 * px + 1, 8 + 8 * px + 1);
    paintGrid(skin.leg, 4, 8, torsoX, 8 + 16 * px + 2);
    paintGrid(skin.leg, 4, 8, torsoX + 4 * px + 0.5, 8 + 16 * px + 2);
  }, [skin, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pixelated h-[84px] w-[72px] shrink-0 border border-white/20 bg-[#090d14]"
      aria-hidden="true"
    />
  );
};

export const BundleArtwork: React.FC<{ item: MarketplaceBundleItem }> = ({ item }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const w = Math.max(120, parent ? parent.clientWidth : 260);
    const h = 76;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (item.worldPreset) {
      const isParkour = item.worldPreset.worldType === 'parkour';
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, isParkour ? '#2e1065' : '#0c4a6e');
      sky.addColorStop(1, isParkour ? '#a21caf' : '#7dd3fc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      if (isParkour) {
        // Floating sky parkour islands + gold goal chest
        drawIsoBlock(ctx, w * 0.25, 50, 28, 12, '#e879f9', '#701a75', '#4a044e');
        drawIsoBlock(ctx, w * 0.5, 40, 28, 12, '#38bdf8', '#0284c7', '#0369a1');
        drawIsoBlock(ctx, w * 0.75, 28, 30, 14, '#facc15', '#b45309', '#78350f');
      } else {
        // Crystal Fjords snowy mountain & ice river diorama
        drawIsoBlock(ctx, w * 0.34, 38, 34, 18, '#e0f2fe', '#64748b', '#475569');
        drawIsoBlock(ctx, w * 0.5, 44, 34, 18, '#38bdf8', '#0284c7', '#0369a1');
        drawIsoBlock(ctx, w * 0.66, 36, 34, 18, '#f0f9ff', '#334155', '#1e293b');
      }
    } else {
      // Supply crate artwork
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#111827');
      bg.addColorStop(1, `${item.accentColor}40`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      // Glowing radial aura behind crate
      const aura = ctx.createRadialGradient(cx, 38, 4, cx, 38, 54);
      aura.addColorStop(0, `${item.accentColor}88`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(cx - 60, 0, 120, h);

      // Isometric Treasure Crate
      drawIsoBlock(ctx, cx, 30, 38, 24, '#b45309', '#92400e', '#78350f', '#fbbf24');
      // Floating gem/item sparkles around the crate
      ctx.fillStyle = item.accentColor;
      ctx.fillRect(cx - 38, 24, 8, 8);
      ctx.fillRect(cx + 30, 22, 8, 8);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 24, 12, 5, 5);
      ctx.fillRect(cx + 22, 14, 5, 5);
    }
  }, [item]);

  return <canvas ref={canvasRef} className="block h-[76px] w-full border-b border-white/10" aria-hidden="true" />;
};
