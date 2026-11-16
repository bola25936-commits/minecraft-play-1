export type SkinPartId = 'head' | 'torso' | 'arm' | 'leg';

export interface PlayerSkin {
  id: string;
  name: string;
  builtIn?: boolean;
  createdAt: number;
  head: string[]; // 8x8 = 64 hex colors
  torso: string[]; // 8x8 = 64 hex colors
  arm: string[]; // 4x8 = 32 hex colors
  leg: string[]; // 4x8 = 32 hex colors
}

export const PART_DIMS: Record<SkinPartId, { w: number; h: number; label: string }> = {
  head: { w: 8, h: 8, label: 'Head (8×8)' },
  torso: { w: 8, h: 8, label: 'Torso (8×8)' },
  arm: { w: 4, h: 8, label: 'Arms (4×8)' },
  leg: { w: 4, h: 8, label: 'Legs (4×8)' },
};

export const SKIN_PALETTE: string[] = [
  '#f2c29b', // Fair skin
  '#d69f7e', // Warm tan skin
  '#a66e4e', // Medium brown skin
  '#6b442b', // Deep brown skin
  '#1b1f29', // Charcoal black
  '#ffffff', // Pure white
  '#94a3b8', // Steel gray
  '#475569', // Dark slate
  '#ef4444', // Crimson red
  '#f97316', // Flame orange
  '#facc15', // Sun yellow
  '#22c55e', // Emerald green
  '#10b981', // Mint emerald
  '#06b6d4', // Cyan aqua
  '#3b82f6', // Cobalt blue
  '#6366f1', // Indigo
  '#a855f7', // Royal purple
  '#ec4899', // Magenta pink
  '#78350f', // Chestnut brown
  '#92400e', // Leather amber
  '#166534', // Forest green
  '#1e3a8a', // Navy blue
  '#581c87', // Deep violet
  '#881337', // Burgundy
];

const SKINS_STORAGE_KEY = 'voxelcraft_custom_skins_v1';
const ACTIVE_SKIN_KEY = 'voxelcraft_active_skin_id_v1';

function paintAsciiGrid(rows: string[], legend: Record<string, string>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    for (const ch of row) {
      out.push(legend[ch] ?? '#d69f7e');
    }
  }
  return out;
}

export const DEFAULT_SKINS: PlayerSkin[] = [
  {
    id: 'preset_emerald_explorer',
    name: 'Emerald Explorer',
    builtIn: true,
    createdAt: 1,
    head: paintAsciiGrid(
      [
        'HHHHHHHH',
        'HHHHHHHH',
        'HSSSSSSH',
        'SSSSSSSS',
        'SWBSSBWS',
        'SSSSSSSS',
        'SSSMMMSS',
        'SSSSSSSS',
      ],
      {
        H: '#4a2e1b',
        S: '#d69f7e',
        W: '#ffffff',
        B: '#1d4ed8',
        M: '#9a5b42',
      }
    ),
    torso: paintAsciiGrid(
      [
        'GGGGGGGG',
        'GGGGGGGG',
        'GGGLLGGG',
        'GGGGGGGG',
        'GGGGGGGG',
        'GGGGGGGG',
        'BBBBBBBB',
        'GGGGGGGG',
      ],
      {
        G: '#16a34a',
        L: '#86efac',
        B: '#78350f',
      }
    ),
    arm: paintAsciiGrid(
      [
        'GGGG',
        'GGGG',
        'GGGG',
        'SSSS',
        'SSSS',
        'SSSS',
        'SSSS',
        'SSSS',
      ],
      {
        G: '#16a34a',
        S: '#d69f7e',
      }
    ),
    leg: paintAsciiGrid(
      [
        'PPPP',
        'PPPP',
        'PPPP',
        'PPPP',
        'PPPP',
        'PPPP',
        'BBBB',
        'BBBB',
      ],
      {
        P: '#1e3a8a',
        B: '#334155',
      }
    ),
  },
  {
    id: 'preset_rainbow_hero',
    name: 'Rainbow Hero',
    builtIn: true,
    createdAt: 2,
    head: paintAsciiGrid(
      [
        'RRRRRRRR',
        'OOYYYYGG',
        'HSSSSSSH',
        'SSSSSSSS',
        'SWPSSSWS',
        'SSSSSSSS',
        'SSSMMMSS',
        'SSSSSSSS',
      ],
      {
        R: '#ef4444',
        O: '#f97316',
        Y: '#facc15',
        G: '#22c55e',
        H: '#1b1f29',
        S: '#f2c29b',
        W: '#ffffff',
        P: '#a855f7',
        M: '#b45309',
      }
    ),
    torso: paintAsciiGrid(
      [
        'RRRRRRRR',
        'OOOOOOOO',
        'YYYYYYYY',
        'GGGGGGGG',
        'CCCCCCCC',
        'BBBBBBBB',
        'PPPPPPPP',
        'MMMMMMMM',
      ],
      {
        R: '#ef4444',
        O: '#f97316',
        Y: '#facc15',
        G: '#22c55e',
        C: '#06b6d4',
        B: '#3b82f6',
        P: '#a855f7',
        M: '#ec4899',
      }
    ),
    arm: paintAsciiGrid(
      [
        'RRRR',
        'OOOO',
        'YYYY',
        'GGGG',
        'CCCC',
        'SSSS',
        'SSSS',
        'SSSS',
      ],
      {
        R: '#ef4444',
        O: '#f97316',
        Y: '#facc15',
        G: '#22c55e',
        C: '#06b6d4',
        S: '#f2c29b',
      }
    ),
    leg: paintAsciiGrid(
      [
        'BBBB',
        'BBBB',
        'PPPP',
        'PPPP',
        'MMMM',
        'MMMM',
        'WWWW',
        'WWWW',
      ],
      {
        B: '#3b82f6',
        P: '#a855f7',
        M: '#ec4899',
        W: '#f8fafc',
      }
    ),
  },
  {
    id: 'preset_cobalt_knight',
    name: 'Cobalt Knight',
    builtIn: true,
    createdAt: 3,
    head: paintAsciiGrid(
      [
        'MMMMMMMM',
        'MLLLLLLM',
        'MLDDDDLM',
        'MLDCCDLM',
        'MLDDDDLM',
        'MLLLLLLM',
        'MMGGGGMM',
        'MMMMMMMM',
      ],
      {
        M: '#475569',
        L: '#94a3b8',
        D: '#1e293b',
        C: '#38bdf8',
        G: '#64748b',
      }
    ),
    torso: paintAsciiGrid(
      [
        'LLLLLLLL',
        'LMMMMMML',
        'LMCCCCML',
        'LMMMMMML',
        'LMMMMMML',
        'GGGGGGGG',
        'DDDDDDDD',
        'LMMMMMML',
      ],
      {
        L: '#94a3b8',
        M: '#64748b',
        C: '#38bdf8',
        G: '#475569',
        D: '#1e293b',
      }
    ),
    arm: paintAsciiGrid(
      [
        'LLLL',
        'MMMM',
        'MMMM',
        'CCCC',
        'MMMM',
        'DDDD',
        'DDDD',
        'DDDD',
      ],
      {
        L: '#94a3b8',
        M: '#64748b',
        C: '#38bdf8',
        D: '#1e293b',
      }
    ),
    leg: paintAsciiGrid(
      [
        'MMMM',
        'MMMM',
        'LLLL',
        'MMMM',
        'MMMM',
        'DDDD',
        'DDDD',
        'DDDD',
      ],
      {
        L: '#94a3b8',
        M: '#475569',
        D: '#1e293b',
      }
    ),
  },
  {
    id: 'preset_sunset_ninja',
    name: 'Sunset Ninja',
    builtIn: true,
    createdAt: 4,
    head: paintAsciiGrid(
      [
        'DDDDDDDD',
        'DDDDDDDD',
        'OOOOOOOO',
        'DSSSSSSD',
        'DSWDDWSD',
        'DDDDDDDD',
        'DDDDDDDD',
        'RRRRRRRR',
      ],
      {
        D: '#1b1f29',
        O: '#f97316',
        S: '#d69f7e',
        W: '#facc15',
        R: '#ef4444',
      }
    ),
    torso: paintAsciiGrid(
      [
        'DDDDDDDD',
        'DRDDDDDD',
        'DDRDDDDD',
        'DDDRDDDD',
        'DDDDRDDD',
        'OOOOOOOO',
        'DDDDDDDD',
        'DDDDDDDD',
      ],
      {
        D: '#1b1f29',
        R: '#ef4444',
        O: '#f97316',
      }
    ),
    arm: paintAsciiGrid(
      [
        'DDDD',
        'DDDD',
        'RRRR',
        'DDDD',
        'DDDD',
        'OOOO',
        'SSSS',
        'SSSS',
      ],
      {
        D: '#1b1f29',
        R: '#ef4444',
        O: '#f97316',
        S: '#d69f7e',
      }
    ),
    leg: paintAsciiGrid(
      [
        'DDDD',
        'DDDD',
        'DDDD',
        'DDDD',
        'RRRR',
        'DDDD',
        'OOOO',
        'DDDD',
      ],
      {
        D: '#1b1f29',
        R: '#ef4444',
        O: '#f97316',
      }
    ),
  },
];

export function createBlankSkin(name = 'Custom Skin'): PlayerSkin {
  return {
    id: `skin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    builtIn: false,
    createdAt: Date.now(),
    head: Array(64).fill('#d69f7e'),
    torso: Array(64).fill('#3b82f6'),
    arm: [
      ...Array(12).fill('#3b82f6'),
      ...Array(20).fill('#d69f7e'),
    ],
    leg: [
      ...Array(24).fill('#1e3a8a'),
      ...Array(8).fill('#334155'),
    ],
  };
}

export function cloneSkin(skin: PlayerSkin, newName?: string): PlayerSkin {
  return {
    id: `skin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: newName ?? `${skin.name} Copy`,
    builtIn: false,
    createdAt: Date.now(),
    head: [...skin.head],
    torso: [...skin.torso],
    arm: [...skin.arm],
    leg: [...skin.leg],
  };
}

export function loadCustomSkins(): PlayerSkin[] {
  try {
    const raw = localStorage.getItem(SKINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is PlayerSkin =>
        !!s &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        Array.isArray(s.head) &&
        s.head.length === 64 &&
        Array.isArray(s.torso) &&
        s.torso.length === 64 &&
        Array.isArray(s.arm) &&
        s.arm.length === 32 &&
        Array.isArray(s.leg) &&
        s.leg.length === 32
    );
  } catch {
    return [];
  }
}

export function saveCustomSkins(skins: PlayerSkin[]): void {
  try {
    const customOnly = skins.filter((s) => !s.builtIn);
    localStorage.setItem(SKINS_STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadAllSkins(): PlayerSkin[] {
  return [...loadCustomSkins(), ...DEFAULT_SKINS];
}

export function getActiveSkinId(): string {
  try {
    return localStorage.getItem(ACTIVE_SKIN_KEY) || DEFAULT_SKINS[0].id;
  } catch {
    return DEFAULT_SKINS[0].id;
  }
}

export function saveActiveSkinId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_SKIN_KEY, id);
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveSkin(): PlayerSkin {
  const all = loadAllSkins();
  const activeId = getActiveSkinId();
  return all.find((s) => s.id === activeId) ?? DEFAULT_SKINS[0];
}

/**
 * Generates an image canvas for the first-person 3D arm viewmodel.
 * Arm grid is 4x8 (top=shoulder/sleeve, bottom=fist/hand).
 * Painted vertically flipped onto a 16x32 canvas so the fist tip (-Z)
 * gets the hand pixels and the shoulder (+Z) gets the sleeve pixels.
 */
export function buildArmSkinCanvas(skin: PlayerSkin): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const scale = 4;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const color = skin.arm[y * 4 + x] || '#d69f7e';
      ctx.fillStyle = color;
      // Flip vertically: y=7 (hand tip) goes to top of canvas (v=1 => -Z tip)
      const destY = (7 - y) * scale;
      ctx.fillRect(x * scale, destY, scale, scale);
    }
  }
  return canvas;
}

/**
 * Generates a small crisp data URL of the skin's 8x8 face for HUD / menu badges.
 */
export function renderSkinFaceDataUrl(skin: PlayerSkin): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = skin.head[y * 8 + x] || '#d69f7e';
      ctx.fillRect(x * 4, y * 4, 4, 4);
    }
  }
  return canvas.toDataURL();
}
