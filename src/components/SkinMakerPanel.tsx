import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eraser,
  FlipHorizontal2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  cloneSkin,
  createBlankSkin,
  PART_DIMS,
  PlayerSkin,
  renderSkinFaceDataUrl,
  SKIN_PALETTE,
  SkinPartId,
} from '../game/skins';

type DrawTool = 'brush' | 'bucket' | 'eyedropper' | 'eraser';

interface SkinMakerPanelProps {
  skins: PlayerSkin[];
  activeSkinId: string;
  onEquipSkin: (id: string) => void;
  onSaveSkin: (skin: PlayerSkin, equip?: boolean) => void;
  onDeleteSkin: (id: string) => void;
}

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

interface BoxPart {
  cx: number;
  cy: number;
  cz: number;
  w: number;
  h: number;
  d: number;
  swing: number;
  pivotY: number;
  grid: string[];
  gw: number;
  gh: number;
  isHead?: boolean;
}

/**
 * Software 3D projected voxel character preview (zero extra WebGL contexts).
 */
const Skin3DPreview: React.FC<{ skin: PlayerSkin }> = ({ skin }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState(0.45);
  const [pitch, setPitch] = useState(0.18);
  const [walking, setWalking] = useState(true);
  const dragRef = useRef<{ active: boolean; x: number; y: number; yaw: number; pitch: number }>({
    active: false,
    x: 0,
    y: 0,
    yaw: 0.45,
    pitch: 0.18,
  });

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Subtle studio radial backdrop + floor pad
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.65);
      grad.addColorStop(0, '#222b3d');
      grad.addColorStop(1, '#0d1118');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const t = walking ? (now - start) * 0.004 : 0;
      const swingAmt = walking ? Math.sin(t) * 0.48 : 0;

      const parts: BoxPart[] = [
        // Head
        {
          cx: 0,
          cy: 1.05,
          cz: 0,
          w: 0.9,
          h: 0.9,
          d: 0.9,
          swing: 0,
          pivotY: 0.6,
          grid: skin.head,
          gw: 8,
          gh: 8,
          isHead: true,
        },
        // Torso
        {
          cx: 0,
          cy: 0.0,
          cz: 0,
          w: 0.9,
          h: 1.2,
          d: 0.48,
          swing: 0,
          pivotY: 0,
          grid: skin.torso,
          gw: 8,
          gh: 8,
        },
        // Left Arm
        {
          cx: -0.68,
          cy: 0.0,
          cz: 0,
          w: 0.42,
          h: 1.18,
          d: 0.42,
          swing: swingAmt,
          pivotY: 0.52,
          grid: skin.arm,
          gw: 4,
          gh: 8,
        },
        // Right Arm
        {
          cx: 0.68,
          cy: 0.0,
          cz: 0,
          w: 0.42,
          h: 1.18,
          d: 0.42,
          swing: -swingAmt,
          pivotY: 0.52,
          grid: skin.arm,
          gw: 4,
          gh: 8,
        },
        // Left Leg
        {
          cx: -0.23,
          cy: -1.16,
          cz: 0,
          w: 0.42,
          h: 1.12,
          d: 0.42,
          swing: -swingAmt * 0.85,
          pivotY: -0.6,
          grid: skin.leg,
          gw: 4,
          gh: 8,
        },
        // Right Leg
        {
          cx: 0.23,
          cy: -1.16,
          cz: 0,
          w: 0.42,
          h: 1.12,
          d: 0.42,
          swing: swingAmt * 0.85,
          pivotY: -0.6,
          grid: skin.leg,
          gw: 4,
          gh: 8,
        },
      ];

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const project = (x: number, y: number, z: number) => {
        // Rotate yaw around Y
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        // Rotate pitch around X
        const ry = y * cosP - rz * sinP;
        const fz = y * sinP + rz * cosP;
        const camDist = 6.2;
        const scale = (W * 0.68) / (camDist - fz);
        return {
          sx: W * 0.5 + rx * scale,
          sy: H * 0.5 - ry * scale,
          depth: fz,
        };
      };

      const rotatePartPt = (part: BoxPart, lx: number, ly: number, lz: number) => {
        const wy = ly + part.cy;
        const wz = lz + part.cz;
        const wx = lx + part.cx;
        if (part.swing === 0) return { x: wx, y: wy, z: wz };
        const dy = wy - part.pivotY;
        const dz = wz;
        const cs = Math.cos(part.swing);
        const sn = Math.sin(part.swing);
        return {
          x: wx,
          y: part.pivotY + dy * cs - dz * sn,
          z: dy * sn + dz * cs,
        };
      };

      interface QuadFace {
        pts: { sx: number; sy: number }[];
        color: string;
        depth: number;
      }

      const quads: QuadFace[] = [];

      const pushPixelGridFace = (
        part: BoxPart,
        face: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom',
        shade: number
      ) => {
        const hw = part.w / 2;
        const hh = part.h / 2;
        const hd = part.d / 2;

        // Compute face center normal check for simple backface culling
        const centerLocal =
          face === 'front'
            ? [0, 0, hd]
            : face === 'back'
              ? [0, 0, -hd]
              : face === 'right'
                ? [hw, 0, 0]
                : face === 'left'
                  ? [-hw, 0, 0]
                  : face === 'top'
                    ? [0, hh, 0]
                    : [0, -hh, 0];

        const p0 = rotatePartPt(part, 0, 0, 0);
        const pf = rotatePartPt(part, centerLocal[0], centerLocal[1], centerLocal[2]);
        const c0 = project(p0.x, p0.y, p0.z);
        const cf = project(pf.x, pf.y, pf.z);
        if (cf.depth <= c0.depth - 0.02) return;

        // Subdivide into painted pixel cells
        const cols = face === 'left' || face === 'right' ? (part.isHead ? 4 : 2) : part.gw;
        const rows = face === 'top' || face === 'bottom' ? 2 : part.gh;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const u0 = c / cols;
            const u1 = (c + 1) / cols;
            const v0 = r / rows;
            const v1 = (r + 1) / rows;

            // Sample pixel from part grid
            let hex = '#d69f7e';
            if (face === 'front') {
              hex = part.grid[r * part.gw + c] ?? hex;
            } else if (face === 'back') {
              if (part.isHead && r < 4) {
                hex = part.grid[0] ?? hex; // hair wraps back of head
              } else {
                const mirrorC = part.gw - 1 - c;
                hex = part.grid[r * part.gw + mirrorC] ?? hex;
              }
            } else if (face === 'right') {
              const edgeC = part.gw - 1;
              hex = part.isHead && r < 3 ? part.grid[0] : part.grid[r * part.gw + edgeC] ?? hex;
            } else if (face === 'left') {
              hex = part.isHead && r < 3 ? part.grid[0] : part.grid[r * part.gw] ?? hex;
            } else if (face === 'top') {
              hex = part.grid[Math.min(part.gw - 1, c)] ?? hex;
            } else {
              hex = part.grid[(part.gh - 1) * part.gw + Math.min(part.gw - 1, c)] ?? hex;
            }

            let corners: [number, number, number][];
            if (face === 'front') {
              const x0 = -hw + u0 * part.w;
              const x1 = -hw + u1 * part.w;
              const y0 = hh - v0 * part.h;
              const y1 = hh - v1 * part.h;
              corners = [
                [x0, y0, hd],
                [x1, y0, hd],
                [x1, y1, hd],
                [x0, y1, hd],
              ];
            } else if (face === 'back') {
              const x0 = hw - u0 * part.w;
              const x1 = hw - u1 * part.w;
              const y0 = hh - v0 * part.h;
              const y1 = hh - v1 * part.h;
              corners = [
                [x0, y0, -hd],
                [x1, y0, -hd],
                [x1, y1, -hd],
                [x0, y1, -hd],
              ];
            } else if (face === 'right') {
              const z0 = hd - u0 * part.d;
              const z1 = hd - u1 * part.d;
              const y0 = hh - v0 * part.h;
              const y1 = hh - v1 * part.h;
              corners = [
                [hw, y0, z0],
                [hw, y0, z1],
                [hw, y1, z1],
                [hw, y1, z0],
              ];
            } else if (face === 'left') {
              const z0 = -hd + u0 * part.d;
              const z1 = -hd + u1 * part.d;
              const y0 = hh - v0 * part.h;
              const y1 = hh - v1 * part.h;
              corners = [
                [-hw, y0, z0],
                [-hw, y0, z1],
                [-hw, y1, z1],
                [-hw, y1, z0],
              ];
            } else if (face === 'top') {
              const x0 = -hw + u0 * part.w;
              const x1 = -hw + u1 * part.w;
              const z0 = -hd + v0 * part.d;
              const z1 = -hd + v1 * part.d;
              corners = [
                [x0, hh, z0],
                [x1, hh, z0],
                [x1, hh, z1],
                [x0, hh, z1],
              ];
            } else {
              const x0 = -hw + u0 * part.w;
              const x1 = -hw + u1 * part.w;
              const z0 = hd - v0 * part.d;
              const z1 = hd - v1 * part.d;
              corners = [
                [x0, -hh, z0],
                [x1, -hh, z0],
                [x1, -hh, z1],
                [x0, -hh, z1],
              ];
            }

            const projected = corners.map(([lx, ly, lz]) => {
              const rp = rotatePartPt(part, lx, ly, lz);
              return project(rp.x, rp.y, rp.z);
            });
            const avgDepth =
              (projected[0].depth + projected[1].depth + projected[2].depth + projected[3].depth) / 4;
            quads.push({
              pts: projected.map((p) => ({ sx: p.sx, sy: p.sy })),
              color: shadeHex(hex, shade),
              depth: avgDepth,
            });
          }
        }
      };

      for (const part of parts) {
        pushPixelGridFace(part, 'front', 1.0);
        pushPixelGridFace(part, 'back', 0.85);
        pushPixelGridFace(part, 'top', 1.08);
        pushPixelGridFace(part, 'bottom', 0.62);
        pushPixelGridFace(part, 'left', 0.8);
        pushPixelGridFace(part, 'right', 0.9);
      }

      quads.sort((a, b) => a.depth - b.depth);
      for (const q of quads) {
        ctx.fillStyle = q.color;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
        ctx.lineTo(q.pts[1].sx, q.pts[1].sy);
        ctx.lineTo(q.pts[2].sx, q.pts[2].sy);
        ctx.lineTo(q.pts[3].sx, q.pts[3].sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (walking) {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [skin, yaw, pitch, walking]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden border border-white/15 bg-[#0d1118]">
        <canvas
          ref={canvasRef}
          width={210}
          height={250}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = { active: true, x: e.clientX, y: e.clientY, yaw, pitch };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.x;
            const dy = e.clientY - dragRef.current.y;
            setYaw(dragRef.current.yaw + dx * 0.014);
            setPitch(Math.max(-0.55, Math.min(0.65, dragRef.current.pitch + dy * 0.01)));
          }}
          onPointerUp={() => {
            dragRef.current.active = false;
          }}
          className="block w-full cursor-grab active:cursor-grabbing"
        />
        <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] font-medium text-slate-400">
          Drag to rotate 3D
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
        <button
          type="button"
          onClick={() => {
            setYaw(0);
            setPitch(0.12);
          }}
          className="border border-white/10 bg-[#1c222e] py-1 text-slate-300 hover:border-white/25 hover:text-white"
        >
          Front
        </button>
        <button
          type="button"
          onClick={() => {
            setYaw(0.5);
            setPitch(0.18);
          }}
          className="border border-white/10 bg-[#1c222e] py-1 text-slate-300 hover:border-white/25 hover:text-white"
        >
          3/4
        </button>
        <button
          type="button"
          onClick={() => {
            setYaw(Math.PI);
            setPitch(0.14);
          }}
          className="border border-white/10 bg-[#1c222e] py-1 text-slate-300 hover:border-white/25 hover:text-white"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setWalking((w) => !w)}
          className={`flex items-center justify-center gap-1 border py-1 ${
            walking
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              : 'border-white/10 bg-[#1c222e] text-slate-300'
          }`}
        >
          <Play className="h-2.5 w-2.5" />
          Walk
        </button>
      </div>
    </div>
  );
};

export const SkinMakerPanel: React.FC<SkinMakerPanelProps> = ({
  skins,
  activeSkinId,
  onEquipSkin,
  onSaveSkin,
  onDeleteSkin,
}) => {
  const initial = skins.find((s) => s.id === activeSkinId) ?? skins[0];
  const [selectedId, setSelectedId] = useState<string>(initial.id);
  const [draft, setDraft] = useState<PlayerSkin>(initial);
  const [part, setPart] = useState<SkinPartId>('head');
  const [tool, setTool] = useState<DrawTool>('brush');
  const [color, setColor] = useState<string>('#22c55e');
  const [mirror, setMirror] = useState<boolean>(false);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<PlayerSkin[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const found = skins.find((s) => s.id === selectedId);
    if (found) {
      setDraft(found);
    } else if (skins[0]) {
      setSelectedId(skins[0].id);
      setDraft(skins[0]);
    }
  }, [skins, selectedId]);

  useEffect(() => {
    const stop = () => setIsPainting(false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const dims = PART_DIMS[part];
  const grid = draft[part];

  const ensureEditableDraft = (): PlayerSkin => {
    if (!draft.builtIn) return draft;
    const copy = cloneSkin(draft, `${draft.name} Custom`);
    setSelectedId(copy.id);
    setDraft(copy);
    return copy;
  };

  const commitDraft = (next: PlayerSkin, pushUndo = true) => {
    if (pushUndo) {
      setUndoStack((prev) => [...prev.slice(-19), draft]);
    }
    setDraft(next);
    onSaveSkin(next, true);
  };

  const applyPixelAction = (x: number, y: number, isDrag = false) => {
    const idx = y * dims.w + x;
    if (tool === 'eyedropper') {
      if (!isDrag) {
        setColor(grid[idx]);
        setTool('brush');
      }
      return;
    }

    const baseSkin = ensureEditableDraft();
    const currentGrid = [...baseSkin[part]];

    if (tool === 'bucket') {
      if (isDrag) return;
      const targetColor = currentGrid[idx];
      if (targetColor.toLowerCase() === color.toLowerCase()) return;
      const visited = new Set<number>();
      const queue: [number, number][] = [[x, y]];
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const ci = cy * dims.w + cx;
        if (cx < 0 || cy < 0 || cx >= dims.w || cy >= dims.h || visited.has(ci)) continue;
        if (currentGrid[ci].toLowerCase() !== targetColor.toLowerCase()) continue;
        visited.add(ci);
        currentGrid[ci] = color;
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      commitDraft({ ...baseSkin, [part]: currentGrid });
      return;
    }

    const eraseFallback =
      part === 'head' ? '#d69f7e' : part === 'torso' ? '#3b82f6' : part === 'arm' ? '#d69f7e' : '#1e3a8a';
    const nextColor = tool === 'eraser' ? eraseFallback : color;

    let changed = false;
    if (currentGrid[idx] !== nextColor) {
      currentGrid[idx] = nextColor;
      changed = true;
    }
    if (mirror) {
      const mx = dims.w - 1 - x;
      const midx = y * dims.w + mx;
      if (currentGrid[midx] !== nextColor) {
        currentGrid[midx] = nextColor;
        changed = true;
      }
    }
    if (changed) {
      commitDraft({ ...baseSkin, [part]: currentGrid }, !isDrag);
    }
  };

  const handleCreateBlank = () => {
    const customCount = skins.filter((s) => !s.builtIn).length;
    const blank = createBlankSkin(`My Skin ${customCount + 1}`);
    setUndoStack([]);
    setSelectedId(blank.id);
    setDraft(blank);
    onSaveSkin(blank, true);
  };

  const handleDuplicate = () => {
    const copy = cloneSkin(draft);
    setUndoStack([]);
    setSelectedId(copy.id);
    setDraft(copy);
    onSaveSkin(copy, true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setDraft(prev);
    if (!prev.builtIn) {
      onSaveSkin(prev, true);
    }
  };

  const handleRename = (name: string) => {
    const base = ensureEditableDraft();
    const updated = { ...base, name };
    setDraft(updated);
    onSaveSkin(updated, false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top Skin Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-[#0d1118] p-2">
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          {skins.map((s) => {
            const isSelected = s.id === draft.id;
            const isEquipped = s.id === activeSkinId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedId(s.id);
                  setDraft(s);
                  setUndoStack([]);
                  setConfirmDeleteId(null);
                }}
                className={`flex shrink-0 items-center gap-1.5 border px-2 py-1 text-left transition ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 text-white'
                    : 'border-white/10 bg-[#171d29] text-slate-300 hover:border-white/25'
                }`}
              >
                <img
                  src={renderSkinFaceDataUrl(s)}
                  alt={s.name}
                  className="pixelated h-5 w-5 border border-black/40"
                />
                <span className="max-w-24 truncate text-[11px] font-bold">{s.name}</span>
                {isEquipped && (
                  <span className="bg-emerald-500/25 px-1 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">
                    On
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateBlank}
            className="flex items-center gap-1 border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            New Skin
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center gap-1 border border-white/15 bg-[#1b2230] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-white/30"
            title="Duplicate Skin"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>

      {/* Main Editor Grid: Pixel Canvas + Palette on Left, 3D Preview on Right */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* Pixel Painter Column */}
        <div className="flex flex-col gap-2.5 md:col-span-7">
          {/* Skin Name & Equip Row */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => handleRename(e.target.value)}
              maxLength={24}
              placeholder="Skin Name..."
              className="w-full border border-white/15 bg-[#0c1017] px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => onEquipSkin(draft.id)}
              className={`flex shrink-0 items-center gap-1 border px-3 py-1 text-xs font-extrabold uppercase ${
                activeSkinId === draft.id
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/35'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {activeSkinId === draft.id ? 'Equipped' : 'Equip'}
            </button>
            {!draft.builtIn &&
              (confirmDeleteId === draft.id ? (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteSkin(draft.id);
                    setConfirmDeleteId(null);
                  }}
                  className="shrink-0 bg-rose-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-400"
                >
                  Confirm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(draft.id)}
                  className="shrink-0 border border-white/15 bg-[#1b2230] p-1.5 text-slate-400 hover:border-rose-400/50 hover:text-rose-300"
                  title="Delete Custom Skin"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ))}
          </div>

          {/* Body Part Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-[#0c1017] p-1">
            {(['head', 'torso', 'arm', 'leg'] as SkinPartId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => setPart(pid)}
                className={`py-1 text-[11px] font-bold transition ${
                  part === pid
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-[#1a2130] hover:text-white'
                }`}
              >
                {PART_DIMS[pid].label}
              </button>
            ))}
          </div>

          {/* Drawing Tools + Canvas */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            {/* Tool Bar */}
            <div className="flex flex-row flex-wrap gap-1 sm:w-24 sm:flex-col">
              <button
                type="button"
                onClick={() => setTool('brush')}
                className={`flex items-center gap-1.5 border px-2 py-1.5 text-[11px] font-semibold ${
                  tool === 'brush'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-[#1a202c] text-slate-300'
                }`}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Brush
              </button>
              <button
                type="button"
                onClick={() => setTool('bucket')}
                className={`flex items-center gap-1.5 border px-2 py-1.5 text-[11px] font-semibold ${
                  tool === 'bucket'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-[#1a202c] text-slate-300'
                }`}
              >
                <PaintBucket className="h-3.5 w-3.5" />
                Fill
              </button>
              <button
                type="button"
                onClick={() => setTool('eyedropper')}
                className={`flex items-center gap-1.5 border px-2 py-1.5 text-[11px] font-semibold ${
                  tool === 'eyedropper'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-[#1a202c] text-slate-300'
                }`}
              >
                <Pipette className="h-3.5 w-3.5" />
                Pick
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`flex items-center gap-1.5 border px-2 py-1.5 text-[11px] font-semibold ${
                  tool === 'eraser'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-[#1a202c] text-slate-300'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                Erase
              </button>
              <button
                type="button"
                onClick={() => setMirror((m) => !m)}
                className={`flex items-center gap-1.5 border px-2 py-1.5 text-[11px] font-semibold ${
                  mirror
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-[#1a202c] text-slate-300'
                }`}
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
                Mirror
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex items-center gap-1.5 border border-white/10 bg-[#1a202c] px-2 py-1.5 text-[11px] font-semibold text-slate-300 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = ensureEditableDraft();
                  const blank = createBlankSkin(base.name);
                  commitDraft({ ...base, [part]: blank[part] });
                }}
                className="flex items-center gap-1.5 border border-white/10 bg-[#1a202c] px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            {/* Pixel Grid */}
            <div className="flex flex-1 items-center justify-center border border-white/10 bg-[#0d1118] p-2.5">
              <div
                className="grid select-none border border-white/20 bg-black"
                style={{
                  gridTemplateColumns: `repeat(${dims.w}, minmax(0, 1fr))`,
                  width: dims.w === 8 ? '184px' : '112px',
                }}
              >
                {grid.map((cellColor, i) => {
                  const x = i % dims.w;
                  const y = Math.floor(i / dims.w);
                  return (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsPainting(true);
                        applyPixelAction(x, y, false);
                      }}
                      onPointerEnter={() => {
                        if (isPainting) applyPixelAction(x, y, true);
                      }}
                      style={{ backgroundColor: cellColor }}
                      className="aspect-square w-full border border-black/20 hover:ring-1 hover:ring-white/80 focus:outline-none"
                      aria-label={`Pixel ${x},${y}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Color Palette + Custom Hex Picker */}
          <div className="flex flex-col gap-1.5 border border-white/10 bg-[#0d1118] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Color Palette
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-slate-300">
                Custom:
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    if (tool === 'eraser' || tool === 'eyedropper') setTool('brush');
                  }}
                  className="h-5 w-7 cursor-pointer border border-white/20 bg-transparent p-0"
                />
                <span className="font-mono text-slate-400">{color}</span>
              </label>
            </div>
            <div className="grid grid-cols-12 gap-1">
              {SKIN_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    setColor(swatch);
                    if (tool === 'eraser' || tool === 'eyedropper') setTool('brush');
                  }}
                  style={{ backgroundColor: swatch }}
                  className={`h-5 w-full border transition ${
                    color.toLowerCase() === swatch.toLowerCase()
                      ? 'scale-110 border-white ring-2 ring-amber-400'
                      : 'border-black/40 hover:scale-105'
                  }`}
                  aria-label={`Color ${swatch}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Live 3D Character Preview Column */}
        <div className="flex flex-col gap-2 md:col-span-5">
          <Skin3DPreview skin={draft} />
          <div className="border border-white/10 bg-[#0d1118] p-2 text-[11px] text-slate-400">
            Painting automatically saves your custom skin. Your painted <span className="text-amber-300">Arms</span> &amp; <span className="text-emerald-300">Face</span> appear live in-game!
          </div>
        </div>
      </div>
    </div>
  );
};
