import * as THREE from 'three';
import { generateBlockTextures } from './textureGenerator';
import { BlockId, BLOCK_DEFS } from './types';

export { generateBlockTextures };

export const ATLAS_GRID = 8; // 8x8 tiles = 64 tiles
export const TILE_PX = 128; // High-resolution 128x128 procedural PBR tiles
export const ATLAS_PX = ATLAS_GRID * TILE_PX; // 1024x1024

function pxHash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = pxHash(ix, iy, seed);
  const b = pxHash(ix + 1, iy, seed);
  const c = pxHash(ix, iy + 1, seed);
  const d = pxHash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmTile(x: number, y: number, seed: number, octaves = 3): number {
  let total = 0;
  let freq = 1;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    total += smoothNoise(x * freq, y * freq, seed + i * 37) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / norm;
}

interface PbrPixel {
  r: number;
  g: number;
  b: number;
  a: number;
  height: number; // 0..1 surface height for normal map
  roughness: number; // 0..1
  metalness: number; // 0..1
  er?: number;
  eg?: number;
  eb?: number;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

function mix3(
  r0: number,
  g0: number,
  b0: number,
  r1: number,
  g1: number,
  b1: number,
  t: number
): [number, number, number] {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(r0 + (r1 - r0) * c),
    Math.round(g0 + (g1 - g0) * c),
    Math.round(b0 + (b1 - b0) * c),
  ];
}

function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${clamp255(r * factor)},${clamp255(g * factor)},${clamp255(b * factor)})`;
}

export type TexturePackId =
  | 'square'
  | 'pbr'
  | 'neon_cyber'
  | 'candy_pastel'
  | 'golden_royal'
  | 'crimson_nether'
  | 'frost_tundra'
  | 'noir_emerald';

export interface ResourcePackVisualConfig {
  label: string;
  waterColor: number;
  skyTint?: number;
  skyBlend: number;
  bloomStrength: number;
}

export const RESOURCE_PACK_VISUALS: Record<TexturePackId, ResourcePackVisualConfig> = {
  pbr: { label: 'Ultra PBR 128px', waterColor: 0x3596d4, skyBlend: 0, bloomStrength: 0.28 },
  square: { label: 'Classic Square 16px', waterColor: 0x2f8ad0, skyBlend: 0, bloomStrength: 0.22 },
  neon_cyber: {
    label: 'Neon Cybergrid',
    waterColor: 0x00f5d4,
    skyTint: 0x160c38,
    skyBlend: 0.45,
    bloomStrength: 0.48,
  },
  candy_pastel: {
    label: 'Sugar & Candy World',
    waterColor: 0x4de8e0,
    skyTint: 0xffb3de,
    skyBlend: 0.34,
    bloomStrength: 0.34,
  },
  golden_royal: {
    label: 'Gilded Royal Marble',
    waterColor: 0x2563eb,
    skyTint: 0xffd166,
    skyBlend: 0.24,
    bloomStrength: 0.36,
  },
  crimson_nether: {
    label: 'Crimson Scorch Pack',
    waterColor: 0xea580c,
    skyTint: 0x7f1d1d,
    skyBlend: 0.5,
    bloomStrength: 0.4,
  },
  frost_tundra: {
    label: 'Frozen Arctic Frost',
    waterColor: 0x38bdf8,
    skyTint: 0xbae6fd,
    skyBlend: 0.35,
    bloomStrength: 0.32,
  },
  noir_emerald: {
    label: 'Noir & Emerald Comic',
    waterColor: 0x10b981,
    skyTint: 0x18181b,
    skyBlend: 0.42,
    bloomStrength: 0.32,
  },
};

export interface TerrainPbrMaps {
  opaqueTexture: THREE.CanvasTexture;
  cutoutTexture: THREE.CanvasTexture;
  squareOpaqueTexture: THREE.CanvasTexture;
  squareCutoutTexture: THREE.CanvasTexture;
  normalTexture: THREE.CanvasTexture;
  roughnessTexture: THREE.CanvasTexture;
  metalnessTexture: THREE.CanvasTexture;
  emissiveTexture: THREE.CanvasTexture;
  waterTexture: THREE.CanvasTexture;
  waterNormalTexture: THREE.CanvasTexture;
  moonTexture: THREE.CanvasTexture;
  grassBladeTexture: THREE.CanvasTexture;
  moteTexture: THREE.CanvasTexture;
  shadowDiscTexture: THREE.CanvasTexture;
  crackTextures: THREE.CanvasTexture[];
  atlasCanvas: HTMLCanvasElement;
  squareAtlasCanvas: HTMLCanvasElement;
  squareNativeCanvas: HTMLCanvasElement;
}

export function paintSquarePackAtlas(
  pbrAtlasCanvas: HTMLCanvasElement,
  squareNativeCanvas: HTMLCanvasElement,
  squareAtlasCanvas: HTMLCanvasElement
): void {
  const nativeW = ATLAS_GRID * 16;
  const nativeH = ATLAS_GRID * 16;
  if (squareNativeCanvas.width !== nativeW) squareNativeCanvas.width = nativeW;
  if (squareNativeCanvas.height !== nativeH) squareNativeCanvas.height = nativeH;

  const ssCtx = squareNativeCanvas.getContext('2d')!;
  ssCtx.imageSmoothingEnabled = false;
  ssCtx.clearRect(0, 0, nativeW, nativeH);
  ssCtx.drawImage(pbrAtlasCanvas, 0, 0, nativeW, nativeH);

  const packTiles = generateBlockTextures();
  const stampNative = (tileIdx: number, src?: HTMLCanvasElement) => {
    if (!src) return;
    const tx = (tileIdx % ATLAS_GRID) * 16;
    const ty = Math.floor(tileIdx / ATLAS_GRID) * 16;
    ssCtx.clearRect(tx, ty, 16, 16);
    ssCtx.drawImage(src, 0, 0, 16, 16, tx, ty, 16, 16);
  };

  stampNative(0, packTiles['grass']);
  stampNative(2, packTiles['dirt']);
  stampNative(3, packTiles['stone']);
  stampNative(4, packTiles['cobblestone']);
  stampNative(5, packTiles['oak_log']);
  stampNative(9, packTiles['sand']);

  // Grass Side (tile 1): procedural dirt base + stepped grass top overhang
  if (packTiles['dirt'] && packTiles['grass']) {
    const tx = 16;
    const ty = 0;
    ssCtx.clearRect(tx, ty, 16, 16);
    ssCtx.drawImage(packTiles['dirt'], 0, 0, 16, 16, tx, ty, 16, 16);
    for (let gx = 0; gx < 16; gx++) {
      const drop = 3 + (gx % 3 === 0 ? 2 : gx % 2 === 0 ? 1 : 0);
      ssCtx.drawImage(packTiles['grass'], gx, 0, 1, drop, tx + gx, ty, 1, drop);
    }
  }

  // Keep Oak Log Top bark rim consistent with procedural oak_log
  if (packTiles['oak_log']) {
    const tx = 6 * 16;
    const ty = 0;
    ssCtx.drawImage(packTiles['oak_log'], 0, 0, 16, 2, tx, ty, 16, 2);
    ssCtx.drawImage(packTiles['oak_log'], 0, 14, 16, 2, tx, ty + 14, 16, 2);
    ssCtx.drawImage(packTiles['oak_log'], 0, 0, 2, 16, tx, ty, 2, 16);
    ssCtx.drawImage(packTiles['oak_log'], 14, 0, 2, 16, tx + 14, ty, 2, 16);
  }

  // Upscale cleanly to UI atlas canvas for crisp item thumbnails
  const saCtx = squareAtlasCanvas.getContext('2d')!;
  saCtx.imageSmoothingEnabled = false;
  saCtx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);
  saCtx.drawImage(squareNativeCanvas, 0, 0, ATLAS_PX, ATLAS_PX);
}

export function createTerrainAtlas(renderer: THREE.WebGLRenderer): TerrainPbrMaps {
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = ATLAS_PX;
  albedoCanvas.height = ATLAS_PX;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(ATLAS_PX, ATLAS_PX);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = ATLAS_PX;
  normalCanvas.height = ATLAS_PX;
  const normalCtx = normalCanvas.getContext('2d')!;
  const normalImg = normalCtx.createImageData(ATLAS_PX, ATLAS_PX);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = ATLAS_PX;
  roughCanvas.height = ATLAS_PX;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(ATLAS_PX, ATLAS_PX);

  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = ATLAS_PX;
  metalCanvas.height = ATLAS_PX;
  const metalCtx = metalCanvas.getContext('2d')!;
  const metalImg = metalCtx.createImageData(ATLAS_PX, ATLAS_PX);

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = ATLAS_PX;
  emissiveCanvas.height = ATLAS_PX;
  const emissiveCtx = emissiveCanvas.getContext('2d')!;
  const emissiveImg = emissiveCtx.createImageData(ATLAS_PX, ATLAS_PX);

  const heightBuf = new Float32Array(TILE_PX * TILE_PX);
  const scaleTo64 = 64 / TILE_PX;

  // Reuse single mutable pixel object inside tight loop for zero GC churn
  const pxOut: PbrPixel = { r: 0, g: 0, b: 0, a: 255, height: 0.5, roughness: 0.8, metalness: 0 };

  const writeTile = (tileIndex: number, pixelFn: (x64: number, y64: number, px: number, py: number, out: PbrPixel) => void) => {
    const tx = (tileIndex % ATLAS_GRID) * TILE_PX;
    const ty = Math.floor(tileIndex / ATLAS_GRID) * TILE_PX;

    for (let py = 0; py < TILE_PX; py++) {
      const y64 = py * scaleTo64;
      for (let px = 0; px < TILE_PX; px++) {
        const x64 = px * scaleTo64;
        pxOut.er = 0;
        pxOut.eg = 0;
        pxOut.eb = 0;
        pixelFn(x64, y64, px, py, pxOut);
        heightBuf[py * TILE_PX + px] = pxOut.height;

        const idx = ((ty + py) * ATLAS_PX + (tx + px)) * 4;
        albedoImg.data[idx] = pxOut.r;
        albedoImg.data[idx + 1] = pxOut.g;
        albedoImg.data[idx + 2] = pxOut.b;
        albedoImg.data[idx + 3] = pxOut.a;

        const rByte = Math.round(Math.max(0.05, Math.min(1, pxOut.roughness)) * 255);
        roughImg.data[idx] = rByte;
        roughImg.data[idx + 1] = rByte;
        roughImg.data[idx + 2] = rByte;
        roughImg.data[idx + 3] = 255;

        const mByte = Math.round(Math.max(0, Math.min(1, pxOut.metalness)) * 255);
        metalImg.data[idx] = mByte;
        metalImg.data[idx + 1] = mByte;
        metalImg.data[idx + 2] = mByte;
        metalImg.data[idx + 3] = 255;

        emissiveImg.data[idx] = pxOut.er ?? 0;
        emissiveImg.data[idx + 1] = pxOut.eg ?? 0;
        emissiveImg.data[idx + 2] = pxOut.eb ?? 0;
        emissiveImg.data[idx + 3] = 255;
      }
    }

    // Compute crisp tangent-space normal map from heightBuf
    const strength = 4.2;
    for (let py = 0; py < TILE_PX; py++) {
      const ym = py > 0 ? py - 1 : 0;
      const yp = py < TILE_PX - 1 ? py + 1 : TILE_PX - 1;
      for (let px = 0; px < TILE_PX; px++) {
        const xm = px > 0 ? px - 1 : 0;
        const xp = px < TILE_PX - 1 ? px + 1 : TILE_PX - 1;

        const dhdx = (heightBuf[py * TILE_PX + xp] - heightBuf[py * TILE_PX + xm]) * strength;
        const dhdy = (heightBuf[yp * TILE_PX + px] - heightBuf[ym * TILE_PX + px]) * strength;

        const nx = -dhdx;
        const ny = dhdy;
        const nz = 1.0;
        const len = Math.hypot(nx, ny, nz);

        const idx = ((ty + py) * ATLAS_PX + (tx + px)) * 4;
        normalImg.data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
        normalImg.data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
        normalImg.data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
        normalImg.data[idx + 3] = 255;
      }
    }
  };

  // Rich organic loam + pebbles dirt helper
  const fillDirt = (x: number, y: number, px: number, py: number, out: PbrPixel) => {
    const n = fbmTile(x * 0.16, y * 0.16, 5, 4);
    const fine = pxHash(px, py, 501);
    const pebble = fbmTile(x * 0.36, y * 0.36, 502, 2);
    let [r, g, b] = mix3(86, 56, 33, 146, 102, 62, n);
    let h = 0.32 + n * 0.48;
    if (pebble > 0.72) {
      [r, g, b] = mix3(r, g, b, 128, 122, 114, 0.58);
      h += 0.22;
    } else if (fine < 0.18) {
      [r, g, b] = mix3(r, g, b, 58, 38, 22, 0.52);
      h -= 0.14;
    }
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = h;
    out.roughness = 0.94;
    out.metalness = 0.0;
  };

  // 0: Grass Top (photogrammetry-style meadow turf, moss, clover & fine soil depth)
  writeTile(0, (x, y, px, py, out) => {
    const macro = fbmTile(x * 0.08, y * 0.08, 1, 4);
    const blade = fbmTile(x * 0.52, y * 0.2, 12, 3);
    const fine = pxHash(px, py, 13);
    let [r, g, b] = mix3(58, 116, 38, 114, 178, 66, macro * 0.6 + blade * 0.4);
    if (fine > 0.86) [r, g, b] = mix3(r, g, b, 144, 198, 86, 0.42);
    if (blade < 0.26) [r, g, b] = mix3(r, g, b, 44, 88, 28, 0.5);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.28 + blade * 0.55 + fine * 0.17;
    out.roughness = 0.87;
    out.metalness = 0.0;
  });

  // 1: Grass Side (overhanging turf blades over organic topsoil)
  writeTile(1, (x, y, px, py, out) => {
    const overhang = 11 + fbmTile(x * 0.22, 0, 2, 3) * 15;
    if (y < overhang) {
      const blade = fbmTile(x * 0.42, y * 0.28, 3, 3);
      const [r, g, b] = mix3(58, 118, 36, 112, 176, 62, blade);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.72 + blade * 0.25;
      out.roughness = 0.86;
      out.metalness = 0.0;
      return;
    }
    fillDirt(x, y, px, py, out);
    if (y < overhang + 3.5) {
      out.r = Math.round(out.r * 0.72);
      out.g = Math.round(out.g * 0.72);
      out.b = Math.round(out.b * 0.72);
      out.height -= 0.18;
    }
  });

  // 2: Dirt
  writeTile(2, fillDirt);

  // 3: Stone (natural fractured granite & mineral flecks)
  writeTile(3, (x, y, px, py, out) => {
    const strata = fbmTile(x * 0.08, y * 0.22, 6, 4);
    const crack = Math.abs(fbmTile(x * 0.19, y * 0.19, 61, 3) - 0.5);
    const grain = pxHash(px, py, 62);
    let [r, g, b] = mix3(92, 96, 102, 156, 160, 166, strata);
    let h = 0.44 + strata * 0.46;
    if (crack < 0.042) {
      [r, g, b] = mix3(r, g, b, 58, 62, 68, 0.72);
      h -= 0.35;
    }
    if (grain > 0.86) [r, g, b] = mix3(r, g, b, 184, 188, 192, 0.35);
    else if (grain < 0.14) [r, g, b] = mix3(r, g, b, 68, 72, 78, 0.35);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = h;
    out.roughness = 0.78;
    out.metalness = 0.04;
  });

  // 4: Cobblestone (square fieldstones & deep recessed mortar)
  writeTile(4, (x, y, _px, _py, out) => {
    const cellX = Math.floor(x / 16);
    const rowOff = (cellX % 2) * 8;
    const cy = Math.floor((y + rowOff) / 16);
    const lx = ((x % 16) + 16) % 16 / 16 - 0.5;
    const ly = (((y + rowOff) % 16) + 16) % 16 / 16 - 0.5;
    const dist = Math.max(Math.abs(lx), Math.abs(ly)) * 2.0;
    const jitter = (fbmTile(x * 0.26, y * 0.26, 8, 3) - 0.5) * 0.08;
    const edge = dist + jitter;
    const tone = pxHash(cellX, cy, 88);

    if (edge > 0.84) {
      out.r = 56;
      out.g = 58;
      out.b = 62;
      out.a = 255;
      out.height = 0.08;
      out.roughness = 0.96;
      out.metalness = 0.0;
      return;
    }
    const surf = fbmTile(x * 0.32, y * 0.32, 89, 2);
    const [r, g, b] = mix3(98, 102, 108, 164, 168, 174, tone * 0.55 + surf * 0.3 + (1 - edge) * 0.15);
    const bevel = Math.max(0, 1 - Math.pow(edge / 0.84, 2.2));
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.28 + bevel * 0.68 + surf * 0.06;
    out.roughness = 0.72;
    out.metalness = 0.05;
  });

  // 5: Oak Log Side (deep furrowed tree bark with moss flecks)
  writeTile(5, (x, y, _px, _py, out) => {
    const furrow = Math.sin(x * 0.48 + fbmTile(x * 0.1, y * 0.09, 9, 3) * 3.4);
    const grain = fbmTile(x * 0.44, y * 0.07, 91, 3);
    const moss = fbmTile(x * 0.18, y * 0.18, 93, 2);
    const t = furrow * 0.45 + grain * 0.55;
    let [r, g, b] = mix3(48, 34, 21, 118, 86, 54, t * 0.5 + 0.5);
    if (moss > 0.72 && furrow < 0) {
      [r, g, b] = mix3(r, g, b, 68, 98, 44, 0.55);
    }
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.22 + (t * 0.5 + 0.5) * 0.75;
    out.roughness = 0.93;
    out.metalness = 0.0;
  });

  // 6: Oak Log Top (square concentric growth rings + bark rim)
  writeTile(6, (x, y, _px, _py, out) => {
    const dx = Math.abs(x - 32);
    const dy = Math.abs(y - 32);
    const dist = Math.max(dx, dy) + fbmTile(x * 0.16, y * 0.16, 92, 2) * 1.6;
    if (dist > 26) {
      out.r = 72;
      out.g = 50;
      out.b = 32;
      out.a = 255;
      out.height = 0.78;
      out.roughness = 0.93;
      out.metalness = 0.0;
      return;
    }
    const ring = Math.sin(dist * 1.5) * 0.5 + 0.5;
    const [r, g, b] = mix3(148, 110, 66, 206, 166, 112, ring);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.42 + ring * 0.28;
    out.roughness = 0.76;
    out.metalness = 0.0;
  });

  // 7: Oak Planks (smooth milled hardwood + plank bevel seams)
  writeTile(7, (x, y, _px, _py, out) => {
    const plankRow = Math.floor(y / 16);
    const localY = y % 16;
    const seamX = (x + plankRow * 32) % 64;
    if (localY < 0.8 || seamX < 0.8) {
      out.r = 86;
      out.g = 60;
      out.b = 34;
      out.a = 255;
      out.height = 0.14;
      out.roughness = 0.9;
      out.metalness = 0.0;
      return;
    }
    const grain = fbmTile(x * 0.08, y * 0.48, 11 + plankRow * 7, 3);
    const [r, g, b] = mix3(148, 108, 62, 196, 152, 96, grain);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.55 + grain * 0.32;
    out.roughness = 0.64;
    out.metalness = 0.02;
  });

  // 8: Oak Leaves (botanical layered leaf silhouettes with light canopy gaps)
  writeTile(8, (x, y, px, py, out) => {
    const cluster = fbmTile(x * 0.24, y * 0.24, 12, 4);
    const vein = pxHash(px, py, 121);
    if (cluster < 0.26) {
      out.r = 32;
      out.g = 72;
      out.b = 20;
      out.a = 0;
      out.height = 0;
      out.roughness = 0.85;
      out.metalness = 0;
      return;
    }
    const [r, g, b] = mix3(38, 88, 24, 98, 168, 56, (cluster - 0.26) / 0.74 + (vein - 0.5) * 0.16);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.28 + cluster * 0.68;
    out.roughness = 0.74;
    out.metalness = 0.0;
  });

  // 9: Sand (wind-rippled dunes with micro quartz glints)
  writeTile(9, (x, y, px, py, out) => {
    const ripple = Math.sin(x * 0.22 + y * 0.38 + fbmTile(x * 0.09, y * 0.09, 13, 3) * 2.6) * 0.5 + 0.5;
    const sparkle = pxHash(px, py, 131);
    const [r, g, b] = mix3(200, 180, 122, 238, 222, 168, ripple * 0.72 + sparkle * 0.28);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.32 + ripple * 0.48;
    out.roughness = sparkle > 0.9 ? 0.38 : 0.88;
    out.metalness = 0.0;
  });

  // 10: Water fallback tile
  writeTile(10, (x, y, _px, _py, out) => {
    const w = Math.sin(x * 0.25 + y * 0.2) * 0.5 + 0.5;
    const [r, g, b] = mix3(28, 102, 176, 74, 158, 224, w);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.5;
    out.roughness = 0.08;
    out.metalness = 0.1;
  });

  // 11: Bedrock
  writeTile(11, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.25, y * 0.25, 15, 3);
    const [r, g, b] = mix3(20, 22, 24, 84, 86, 92, n);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = n;
    out.roughness = 0.9;
    out.metalness = 0.15;
  });

  // Ores with metallic/crystalline PBR highlights
  const writeOre = (
    tileIdx: number,
    oreRgb: [number, number, number],
    hiRgb: [number, number, number],
    rough: number,
    metal: number,
    seed: number,
    emissiveBoost = false
  ) => {
    writeTile(tileIdx, (x, y, px, py, out) => {
      const strata = fbmTile(x * 0.1, y * 0.2, 6, 3);
      const vein = fbmTile(x * 0.24, y * 0.24, seed, 3);
      const facet = pxHash(Math.floor(px / 3), Math.floor(py / 3), seed + 5);

      if (x > 4 && x < 60 && y > 4 && y < 60 && vein > 0.65) {
        const col = facet > 0.65 ? hiRgb : oreRgb;
        out.r = col[0];
        out.g = col[1];
        out.b = col[2];
        out.a = 255;
        out.height = 0.85 + facet * 0.15;
        out.roughness = rough;
        out.metalness = metal;
        if (emissiveBoost && facet > 0.72) {
          out.er = Math.round(hiRgb[0] * 0.35);
          out.eg = Math.round(hiRgb[1] * 0.35);
          out.eb = Math.round(hiRgb[2] * 0.35);
        }
        return;
      }
      const [r, g, b] = mix3(94, 98, 104, 148, 152, 158, strata);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.4 + strata * 0.35;
      out.roughness = 0.82;
      out.metalness = 0.04;
    });
  };

  writeOre(12, [28, 30, 34], [58, 62, 68], 0.52, 0.15, 20); // Coal
  writeOre(13, [196, 152, 118], [238, 206, 178], 0.34, 0.78, 25); // Iron
  writeOre(14, [230, 182, 34], [255, 240, 128], 0.18, 0.94, 30); // Gold
  writeOre(15, [40, 204, 218], [156, 250, 255], 0.1, 0.25, 35, true); // Diamond crystal

  // 16: Glass (glossy crystal pane)
  writeTile(16, (x, y, _px, _py, out) => {
    const border = x < 3 || x > 60 || y < 3 || y > 60;
    const gleam = Math.abs(x - y) < 3 && x > 10 && x < 24;
    if (border) {
      out.r = 168; out.g = 212; out.b = 226; out.a = 255;
      out.height = 0.85; out.roughness = 0.25; out.metalness = 0.2;
      return;
    }
    if (gleam) {
      out.r = 235; out.g = 250; out.b = 255; out.a = 195;
      out.height = 0.6; out.roughness = 0.06; out.metalness = 0.1;
      return;
    }
    out.r = 185; out.g = 232; out.b = 248; out.a = 72;
    out.height = 0.5; out.roughness = 0.06; out.metalness = 0.05;
  });

  // 17: Brick (terracotta masonry + recessed mortar)
  writeTile(17, (x, y, _px, _py, out) => {
    const row = Math.floor(y / 16);
    const localY = y % 16;
    const localX = (x + (row % 2) * 16) % 32;
    if (localY < 1.8 || localX < 1.8) {
      out.r = 196; out.g = 190; out.b = 180; out.a = 255;
      out.height = 0.18; out.roughness = 0.94; out.metalness = 0.0;
      return;
    }
    const n = fbmTile(x * 0.24, y * 0.24, 40 + row * 3, 3);
    const [r, g, b] = mix3(124, 48, 36, 174, 78, 58, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.72 + n * 0.22; out.roughness = 0.82; out.metalness = 0.0;
  });

  // 18: Crafting Table Top
  writeTile(18, (x, y, _px, _py, out) => {
    const border = x < 4 || x > 59 || y < 4 || y > 59;
    if (border) {
      out.r = 108; out.g = 72; out.b = 38; out.a = 255;
      out.height = 0.78; out.roughness = 0.75; out.metalness = 0.02;
      return;
    }
    const gx = (x - 4) % 18;
    const gy = (y - 4) % 18;
    if (gx < 1.6 || gy < 1.6) {
      out.r = 72; out.g = 44; out.b = 20; out.a = 255;
      out.height = 0.35; out.roughness = 0.85; out.metalness = 0.0;
      return;
    }
    const grain = fbmTile(x * 0.12, y * 0.32, 42, 3);
    const [r, g, b] = mix3(160, 114, 62, 192, 144, 86, grain);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.65 + grain * 0.2; out.roughness = 0.68; out.metalness = 0.0;
  });

  // 19: Crafting Table Side
  writeTile(19, (x, y, _px, _py, out) => {
    if (y < 10) {
      out.r = 110; out.g = 74; out.b = 38; out.a = 255;
      out.height = 0.75; out.roughness = 0.75; out.metalness = 0.02;
      return;
    }
    if (x > 14 && x < 26 && y > 20 && y < 48) {
      out.r = 168; out.g = 178; out.b = 188; out.a = 255;
      out.height = 0.9; out.roughness = 0.28; out.metalness = 0.88;
      return;
    }
    if (x > 38 && x < 48 && y > 22 && y < 52) {
      out.r = 86; out.g = 56; out.b = 30; out.a = 255;
      out.height = 0.85; out.roughness = 0.75; out.metalness = 0.05;
      return;
    }
    const grain = fbmTile(x * 0.1, y * 0.35, 43, 2);
    const [r, g, b] = mix3(146, 108, 60, 180, 138, 82, grain);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.55 + grain * 0.2; out.roughness = 0.72; out.metalness = 0.0;
  });

  // 20: Furnace Front (glowing hearth)
  writeTile(20, (x, y, _px, _py, out) => {
    if (x > 14 && x < 50 && y > 30 && y < 56) {
      if (y > 42) {
        const ember = fbmTile(x * 0.3, y * 0.3, 44, 2);
        const gCol = Math.round(110 + ember * 120);
        out.r = 255; out.g = gCol; out.b = 30; out.a = 255;
        out.height = 0.2; out.roughness = 0.5; out.metalness = 0.0;
        out.er = 255; out.eg = Math.round(105 + ember * 100); out.eb = 25;
        return;
      }
      out.r = 28; out.g = 28; out.b = 30; out.a = 255;
      out.height = 0.15; out.roughness = 0.9; out.metalness = 0.1;
      return;
    }
    const n = fbmTile(x * 0.2, y * 0.2, 45, 3);
    const [r, g, b] = mix3(102, 106, 112, 142, 146, 152, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.5 + n * 0.35; out.roughness = 0.76; out.metalness = 0.12;
  });

  // 21: Furnace Top/Side
  writeTile(21, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.2, y * 0.2, 46, 3);
    const [r, g, b] = mix3(106, 110, 116, 144, 148, 154, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.45 + n * 0.35; out.roughness = 0.78; out.metalness = 0.1;
  });

  // 22: Torch (emissive flame tip)
  writeTile(22, (x, y, _px, _py, out) => {
    if (x >= 26 && x <= 37) {
      if (y >= 8 && y <= 20) {
        const core = x >= 29 && x <= 34 && y >= 11 && y <= 18;
        out.r = 255; out.g = core ? 245 : 165; out.b = core ? 150 : 35; out.a = 255;
        out.height = 0.9; out.roughness = 0.2; out.metalness = 0.0;
        out.er = 255; out.eg = core ? 230 : 140; out.eb = core ? 120 : 20;
        return;
      }
      if (y >= 21 && y <= 60) {
        out.r = 126; out.g = 84; out.b = 44; out.a = 255;
        out.height = 0.7; out.roughness = 0.85; out.metalness = 0.0;
        return;
      }
    }
    out.r = 0; out.g = 0; out.b = 0; out.a = 0;
    out.height = 0; out.roughness = 1; out.metalness = 0;
  });

  // 23: Snow (crystalline frost sparkle)
  writeTile(23, (x, y, px, py, out) => {
    const drift = fbmTile(x * 0.12, y * 0.12, 47, 3);
    const glint = pxHash(px, py, 471);
    const [r, g, b] = mix3(218, 232, 244, 255, 255, 255, drift * 0.7 + glint * 0.3);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.4 + drift * 0.45;
    out.roughness = glint > 0.88 ? 0.16 : 0.6;
    out.metalness = 0.0;
  });

  // 24: Gravel
  writeTile(24, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.4, y * 0.4, 48, 3);
    const [r, g, b] = mix3(88, 84, 80, 164, 158, 152, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = n; out.roughness = 0.9; out.metalness = 0.04;
  });

  // 25: Cactus Side
  writeTile(25, (x, y, _px, _py, out) => {
    const rib = Math.sin(x * 0.5) * 0.5 + 0.5;
    const spine = Math.floor(x) % 14 === 3 && Math.floor(y) % 12 === 4;
    if (spine) {
      out.r = 224; out.g = 234; out.b = 178; out.a = 255;
      out.height = 0.98; out.roughness = 0.5; out.metalness = 0;
      return;
    }
    const [r, g, b] = mix3(36, 98, 32, 66, 146, 54, rib);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.35 + rib * 0.55; out.roughness = 0.8; out.metalness = 0;
  });

  // 26: Cactus Top
  writeTile(26, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.25, y * 0.25, 49, 2);
    const [r, g, b] = mix3(44, 116, 38, 76, 156, 62, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.5 + n * 0.3; out.roughness = 0.8; out.metalness = 0;
  });

  // 27: Sandstone Top
  writeTile(27, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.2, y * 0.2, 50, 3);
    const [r, g, b] = mix3(204, 184, 126, 234, 218, 162, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.45 + n * 0.35; out.roughness = 0.85; out.metalness = 0;
  });

  // 28: Sandstone Side
  writeTile(28, (x, y, _px, _py, out) => {
    const band = Math.sin(y * 0.28 + fbmTile(x * 0.1, y * 0.1, 51, 2) * 1.5) * 0.5 + 0.5;
    const [r, g, b] = mix3(188, 164, 108, 228, 210, 152, band);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.4 + band * 0.45; out.roughness = 0.84; out.metalness = 0;
  });

  // 29: Clay
  writeTile(29, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.16, y * 0.16, 52, 3);
    const [r, g, b] = mix3(134, 142, 158, 174, 184, 198, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.45 + n * 0.25; out.roughness = 0.58; out.metalness = 0.02;
  });

  // 30: Wool Block (woven square textile fibers)
  writeTile(30, (x, y, _px, _py, out) => {
    const weave = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * 0.18;
    const n = fbmTile(x * 0.28, y * 0.28, 53, 3);
    const [r, g, b] = mix3(218, 218, 214, 248, 248, 244, n * 0.7 + weave);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.4 + n * 0.35 + weave; out.roughness = 0.95; out.metalness = 0.0;
  });

  // 31: Mossy Cobblestone (square fieldstones + creeping green moss)
  writeTile(31, (x, y, _px, _py, out) => {
    const cellX = Math.floor(x / 16);
    const rowOff = (cellX % 2) * 8;
    const cy = Math.floor((y + rowOff) / 16);
    const lx = ((x % 16) + 16) % 16 / 16 - 0.5;
    const ly = (((y + rowOff) % 16) + 16) % 16 / 16 - 0.5;
    const dist = Math.max(Math.abs(lx), Math.abs(ly)) * 2.0;
    const moss = fbmTile(x * 0.22, y * 0.22, 54, 3);
    if (moss > 0.56 || dist > 0.84) {
      const [mr, mg, mb] = mix3(46, 88, 30, 88, 144, 52, moss);
      out.r = mr; out.g = mg; out.b = mb; out.a = 255;
      out.height = dist > 0.84 ? 0.25 : 0.65; out.roughness = 0.92; out.metalness = 0.0;
      return;
    }
    const tone = pxHash(cellX, cy, 88);
    const [r, g, b] = mix3(96, 100, 106, 160, 164, 170, tone);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.72; out.roughness = 0.75; out.metalness = 0.04;
  });

  // 32: Chest Top
  writeTile(32, (x, y, _px, _py, out) => {
    const border = x < 6 || x > 57 || y < 6 || y > 57;
    const grain = fbmTile(x * 0.1, y * 0.4, 55, 2);
    const [r, g, b] = border
      ? mix3(86, 54, 24, 114, 74, 34, grain)
      : mix3(156, 106, 48, 192, 138, 68, grain);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = border ? 0.78 : 0.58; out.roughness = 0.66; out.metalness = 0.04;
  });

  // 33: Chest Side / Front Latch
  writeTile(33, (x, y, _px, _py, out) => {
    const seamY = y >= 22 && y <= 26;
    const latch = x >= 27 && x <= 36 && y >= 18 && y <= 32;
    if (latch) {
      out.r = 212; out.g = 216; out.b = 222; out.a = 255;
      out.height = 0.95; out.roughness = 0.25; out.metalness = 0.92;
      return;
    }
    if (seamY || x < 5 || x > 58 || y < 5 || y > 58) {
      out.r = 72; out.g = 44; out.b = 18; out.a = 255;
      out.height = 0.3; out.roughness = 0.85; out.metalness = 0.02;
      return;
    }
    const grain = fbmTile(x * 0.12, y * 0.35, 56, 2);
    const [r, g, b] = mix3(152, 102, 46, 188, 134, 66, grain);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.62; out.roughness = 0.68; out.metalness = 0.02;
  });

  // 34: Bookshelf Side
  writeTile(34, (x, y, _px, _py, out) => {
    if (y < 6 || (y >= 29 && y <= 34) || y > 57 || x < 4 || x > 59) {
      const g = fbmTile(x * 0.1, y * 0.3, 57, 2);
      const [r, gr, b] = mix3(138, 98, 54, 178, 134, 78, g);
      out.r = r; out.g = gr; out.b = b; out.a = 255;
      out.height = 0.82; out.roughness = 0.7; out.metalness = 0.02;
      return;
    }
    const bookCol = Math.floor(x / 7);
    const bookEdge = x % 7 === 0;
    if (bookEdge || (y > 6 && y < 10) || (y > 34 && y < 38)) {
      out.r = 34; out.g = 24; out.b = 16; out.a = 255;
      out.height = 0.22; out.roughness = 0.9; out.metalness = 0;
      return;
    }
    const palette: [number, number, number][] = [
      [168, 42, 42],
      [42, 92, 168],
      [46, 132, 62],
      [162, 122, 38],
      [118, 54, 148],
    ];
    const picked = palette[(bookCol + (y > 32 ? 2 : 0)) % palette.length];
    const band = y % 12 === 2;
    out.r = band ? 232 : picked[0];
    out.g = band ? 204 : picked[1];
    out.b = band ? 120 : picked[2];
    out.a = 255;
    out.height = 0.68; out.roughness = 0.62; out.metalness = band ? 0.45 : 0.05;
  });

  // 35: TNT Side (red sticks + crisp white band + square TNT label)
  writeTile(35, (x, y, _px, _py, out) => {
    const gx = Math.floor(x / 4);
    const gy = Math.floor(y / 4);
    if (y >= 20 && y <= 43) {
      // Crisp 16x16 grid block letters T N T centered inside white stripe
      const isLetter =
        gy >= 6 && gy <= 9 && (
          // T
          (gx >= 2 && gx <= 4 && (gy === 6 || gx === 3)) ||
          // N
          (gx >= 6 && gx <= 9 && (gx === 6 || gx === 9 || (gx === 7 && gy === 7) || (gx === 8 && gy === 8))) ||
          // T
          (gx >= 11 && gx <= 13 && (gy === 6 || gx === 12))
        );
      if (isLetter) {
        out.r = 22; out.g = 22; out.b = 24; out.a = 255;
        out.height = 0.72; out.roughness = 0.7; out.metalness = 0;
        return;
      }
      out.r = 238; out.g = 236; out.b = 230; out.a = 255;
      out.height = 0.68; out.roughness = 0.75; out.metalness = 0;
      return;
    }
    const stickSeam = Math.floor(x) % 8 === 0;
    out.r = stickSeam ? 132 : 198;
    out.g = stickSeam ? 26 : 42;
    out.b = stickSeam ? 20 : 34;
    out.a = 255;
    out.height = stickSeam ? 0.35 : 0.8; out.roughness = 0.66; out.metalness = 0.05;
  });

  // 36: TNT Top/Bottom
  writeTile(36, (x, y, _px, _py, out) => {
    const dist = Math.max(Math.abs(x - 32), Math.abs(y - 32));
    if (dist < 6) {
      out.r = 32; out.g = 32; out.b = 34; out.a = 255;
      out.height = 0.9; out.roughness = 0.8; out.metalness = 0.1;
      return;
    }
    const cell = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
    out.r = cell ? 196 : 158; out.g = cell ? 42 : 30; out.b = cell ? 34 : 24; out.a = 255;
    out.height = cell ? 0.78 : 0.6; out.roughness = 0.7; out.metalness = 0.02;
  });

  // 37: Obsidian (volcanic dark purple-black glass)
  writeTile(37, (x, y, _px, _py, out) => {
    const n = fbmTile(x * 0.24, y * 0.24, 58, 3);
    const fleck = fbmTile(x * 0.38, y * 0.38, 59, 2);
    const [r, g, b] = fleck > 0.72
      ? mix3(68, 42, 108, 108, 68, 158, fleck)
      : mix3(16, 12, 24, 38, 28, 54, n);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.4 + n * 0.5; out.roughness = 0.28; out.metalness = 0.18;
  });

  // 38: Glowstone (warm amber-gold radiant blocks)
  writeTile(38, (x, y, _px, _py, out) => {
    const cell = fbmTile(x * 0.32, y * 0.32, 60, 3);
    const [r, g, b] = mix3(168, 108, 32, 255, 224, 118, cell);
    out.r = r; out.g = g; out.b = b; out.a = 255;
    out.height = 0.35 + cell * 0.55; out.roughness = 0.38; out.metalness = 0.05;
    out.er = Math.round(r * 0.85);
    out.eg = Math.round(g * 0.82);
    out.eb = Math.round(b * 0.6);
  });

  // Square decorative metallic/crystal block generator
  const writeGemBlock = (
    tileIdx: number,
    baseRgb: [number, number, number],
    hiRgb: [number, number, number],
    rough: number,
    metal: number,
    seed: number
  ) => {
    writeTile(tileIdx, (x, y, _px, _py, out) => {
      const edge = Math.max(Math.abs(x - 32), Math.abs(y - 32));
      const frame = edge > 25 && edge < 30;
      const border = edge >= 30;
      const glint = fbmTile(x * 0.2, y * 0.2, seed, 2);
      const t = frame ? 0.92 : border ? 0.18 : 0.42 + glint * 0.42;
      const [r, g, b] = mix3(baseRgb[0], baseRgb[1], baseRgb[2], hiRgb[0], hiRgb[1], hiRgb[2], t);
      out.r = r; out.g = g; out.b = b; out.a = 255;
      out.height = frame ? 0.92 : border ? 0.25 : 0.65 + glint * 0.2;
      out.roughness = rough;
      out.metalness = metal;
    });
  };

  writeGemBlock(39, [196, 144, 18], [255, 236, 98], 0.16, 0.96, 61); // Gold Block
  writeGemBlock(40, [156, 162, 170], [238, 242, 248], 0.22, 0.92, 62); // Iron Block
  writeGemBlock(41, [34, 186, 202], [156, 248, 255], 0.1, 0.28, 63); // Diamond Block
  writeOre(42, [34, 178, 72], [116, 248, 148], 0.12, 0.22, 64, true); // Emerald Ore
  writeGemBlock(43, [26, 162, 62], [118, 246, 148], 0.12, 0.24, 65); // Emerald Block

  // 44: Deepslate (dark basalt-slate cavern rock with subtle cool striations)
  writeTile(44, (x, y, px, py, out) => {
    const strata = fbmTile(x * 0.08, y * 0.28, 66, 4);
    const crack = Math.abs(fbmTile(x * 0.22, y * 0.14, 67, 3) - 0.5);
    const grain = pxHash(px, py, 68);
    let [r, g, b] = mix3(38, 42, 52, 74, 80, 96, strata);
    let h = 0.4 + strata * 0.48;
    if (crack < 0.048) {
      [r, g, b] = mix3(r, g, b, 20, 22, 30, 0.78);
      h -= 0.34;
    }
    if (grain > 0.88) [r, g, b] = mix3(r, g, b, 98, 108, 124, 0.3);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = h;
    out.roughness = 0.72;
    out.metalness = 0.1;
  });

  // 45: Cave Moss Top (bioluminescent subterranean moss & glowing teal spore flecks)
  writeTile(45, (x, y, px, py, out) => {
    const macro = fbmTile(x * 0.12, y * 0.12, 69, 4);
    const spore = pxHash(px, py, 70);
    let [r, g, b] = mix3(36, 86, 48, 84, 158, 78, macro);
    let er = 0;
    let eg = 0;
    let eb = 0;
    if (spore > 0.965) {
      [r, g, b] = [110, 245, 205];
      er = 55;
      eg = 195;
      eb = 155;
    }
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.35 + macro * 0.55;
    out.roughness = 0.88;
    out.metalness = 0.0;
    out.er = er;
    out.eg = eg;
    out.eb = eb;
  });

  // 46: Cave Moss Side (creeping cavern moss overhanging dark deepslate)
  writeTile(46, (x, y, px, py, out) => {
    const overhang = 18 + fbmTile(x * 0.2, 0, 71, 3) * 20;
    if (y < overhang) {
      const m = fbmTile(x * 0.25, y * 0.25, 72, 3);
      const [r, g, b] = mix3(38, 90, 48, 86, 162, 82, m);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.72 + m * 0.22;
      out.roughness = 0.86;
      out.metalness = 0.0;
      if (pxHash(px, py, 73) > 0.97) {
        out.er = 48;
        out.eg = 175;
        out.eb = 135;
      }
      return;
    }
    const strata = fbmTile(x * 0.1, y * 0.26, 66, 3);
    const [r, g, b] = mix3(40, 44, 54, 72, 78, 92, strata);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.36 + strata * 0.35;
    out.roughness = 0.76;
    out.metalness = 0.08;
  });

  // 47: Dripstone (warm layered limestone & mineral travertine)
  writeTile(47, (x, y, _px, _py, out) => {
    const streak = fbmTile(x * 0.34, y * 0.08, 74, 4);
    const band = Math.sin(y * 0.24 + streak * 3.0) * 0.5 + 0.5;
    const [r, g, b] = mix3(132, 108, 84, 198, 174, 142, streak * 0.65 + band * 0.35);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.32 + streak * 0.55;
    out.roughness = 0.74;
    out.metalness = 0.03;
  });

  // 48: Crystal Cluster (luminous cyan-violet geode facets for bloom-lit caverns)
  writeTile(48, (x, y, px, py, out) => {
    const shard = fbmTile(x * 0.28, y * 0.28, 75, 3);
    const facet = pxHash(Math.floor(px / 4), Math.floor(py / 4), 76);
    const isCore = shard > 0.52 || facet > 0.78;
    if (isCore) {
      const [r, g, b] = mix3(86, 206, 255, 204, 148, 255, facet);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.8 + facet * 0.2;
      out.roughness = 0.1;
      out.metalness = 0.22;
      out.er = Math.round(r * 0.82);
      out.eg = Math.round(g * 0.82);
      out.eb = Math.round(b * 0.92);
      return;
    }
    const [r, g, b] = mix3(32, 28, 56, 66, 56, 112, shard);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.32 + shard * 0.35;
    out.roughness = 0.35;
    out.metalness = 0.18;
    out.er = 18;
    out.eg = 36;
    out.eb = 68;
  });

  // 49: Glow Vine (alpha-cutout hanging vine strands + warm bioluminescent berries)
  writeTile(49, (x, y, _px, _py, out) => {
    const strand1 = Math.abs(x - (20 + Math.sin(y * 0.22) * 5)) < 3.2;
    const strand2 = Math.abs(x - (44 + Math.cos(y * 0.18) * 5)) < 2.8 && y < 56;
    const leaf = fbmTile(x * 0.3, y * 0.3, 77, 2) > 0.62 && (Math.abs(x - 20) < 11 || Math.abs(x - 44) < 10);
    const berry1 = Math.hypot(x - 21, y - 22) < 4.2 || Math.hypot(x - 19, y - 48) < 4.5;
    const berry2 = Math.hypot(x - 44, y - 34) < 4.0;

    if (berry1 || berry2) {
      out.r = 255;
      out.g = 224;
      out.b = 98;
      out.a = 255;
      out.height = 0.92;
      out.roughness = 0.24;
      out.metalness = 0.0;
      out.er = 255;
      out.eg = 196;
      out.eb = 68;
      return;
    }
    if (strand1 || strand2 || leaf) {
      const shade = fbmTile(x * 0.4, y * 0.4, 78, 2);
      const [r, g, b] = mix3(36, 98, 38, 76, 162, 66, shade);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.65;
      out.roughness = 0.78;
      out.metalness = 0.0;
      return;
    }
    out.r = 0;
    out.g = 0;
    out.b = 0;
    out.a = 0;
    out.height = 0;
    out.roughness = 1;
    out.metalness = 0;
  });

  // 50: Netherrack (craggy crimson-maroon volcanic rock)
  writeTile(50, (x, y, px, py, out) => {
    const strata = fbmTile(x * 0.16, y * 0.16, 81, 4);
    const fissure = Math.abs(fbmTile(x * 0.25, y * 0.25, 82, 3) - 0.5);
    const grit = pxHash(px, py, 83);
    let [r, g, b] = mix3(92, 24, 24, 152, 54, 48, strata);
    let h = 0.36 + strata * 0.52;
    if (fissure < 0.065) {
      [r, g, b] = mix3(r, g, b, 46, 12, 12, 0.78);
      h -= 0.32;
    } else if (grit > 0.88) {
      [r, g, b] = mix3(r, g, b, 186, 88, 72, 0.4);
      h += 0.15;
    }
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = h;
    out.roughness = 0.88;
    out.metalness = 0.04;
  });

  // 51: Nether Bricks (deep dark-crimson fortress masonry)
  writeTile(51, (x, y, _px, _py, out) => {
    const row = Math.floor(y / 16);
    const localY = y % 16;
    const localX = (x + (row % 2) * 16) % 32;
    if (localY < 1.8 || localX < 1.8) {
      out.r = 28;
      out.g = 12;
      out.b = 18;
      out.a = 255;
      out.height = 0.14;
      out.roughness = 0.94;
      out.metalness = 0.0;
      return;
    }
    const n = fbmTile(x * 0.22, y * 0.22, 84 + row * 5, 3);
    const [r, g, b] = mix3(48, 20, 28, 86, 40, 48, n);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.7 + n * 0.22;
    out.roughness = 0.78;
    out.metalness = 0.06;
  });

  // 52: Soul Sand (dark umber soul-etched sand)
  writeTile(52, (x, y, px, py, out) => {
    const ripple = fbmTile(x * 0.18, y * 0.18, 85, 4);
    const pocket = Math.hypot(((x % 32) - 16), ((y % 32) - 16));
    const grain = pxHash(px, py, 86);
    let [r, g, b] = mix3(66, 50, 38, 108, 84, 66, ripple);
    let h = 0.35 + ripple * 0.45;
    if (pocket < 6.5) {
      [r, g, b] = mix3(r, g, b, 38, 28, 22, 0.7);
      h -= 0.25;
    }
    if (grain > 0.85) [r, g, b] = mix3(r, g, b, 128, 104, 84, 0.35);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = h;
    out.roughness = 0.95;
    out.metalness = 0.0;
  });

  // 53: Nether Quartz Ore (netherrack with bright pearly-white crystals)
  writeTile(53, (x, y, px, py, out) => {
    const strata = fbmTile(x * 0.16, y * 0.16, 81, 3);
    const vein = fbmTile(x * 0.26, y * 0.26, 87, 3);
    const facet = pxHash(Math.floor(px / 3), Math.floor(py / 3), 88);
    if (x > 4 && x < 60 && y > 4 && y < 60 && vein > 0.63) {
      const [r, g, b] = facet > 0.55 ? [250, 246, 238] : [214, 202, 188];
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.88 + facet * 0.12;
      out.roughness = 0.22;
      out.metalness = 0.08;
      if (facet > 0.72) {
        out.er = 60;
        out.eg = 56;
        out.eb = 50;
      }
      return;
    }
    const [r, g, b] = mix3(94, 26, 26, 148, 52, 46, strata);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.4 + strata * 0.42;
    out.roughness = 0.86;
    out.metalness = 0.04;
  });

  // 54: Lava (glowing molten magma rivers & bright orange crusts)
  writeTile(54, (x, y, _px, _py, out) => {
    const flow = fbmTile(x * 0.14, y * 0.14, 89, 4);
    const crust = fbmTile(x * 0.26 + 3, y * 0.26 - 2, 90, 3);
    const hot = flow * 0.6 + crust * 0.4;
    if (hot > 0.62) {
      const [r, g, b] = mix3(255, 138, 16, 255, 242, 118, (hot - 0.62) / 0.38);
      out.r = r;
      out.g = g;
      out.b = b;
      out.a = 255;
      out.height = 0.45 + hot * 0.3;
      out.roughness = 0.24;
      out.metalness = 0.0;
      out.er = r;
      out.eg = Math.round(g * 0.88);
      out.eb = Math.round(b * 0.45);
      return;
    }
    const [r, g, b] = mix3(158, 32, 8, 242, 94, 14, hot / 0.62);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.3 + hot * 0.2;
    out.roughness = 0.45;
    out.metalness = 0.0;
    out.er = Math.round(r * 0.8);
    out.eg = Math.round(g * 0.65);
    out.eb = 8;
  });

  // 55: Nether Portal (luminous violet-magenta swirling energy pane)
  writeTile(55, (x, y, px, py, out) => {
    const dx = x - 32;
    const dy = y - 32;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    const swirl = Math.sin(dist * 0.32 - angle * 3.0) * 0.5 + 0.5;
    const shimmer = fbmTile(x * 0.2, y * 0.2, 91, 3);
    const gap = pxHash(Math.floor(px / 2), Math.floor(py / 2), 92);
    if (gap < 0.14 && swirl < 0.45) {
      out.r = 95;
      out.g = 24;
      out.b = 165;
      out.a = 0;
      out.height = 0.2;
      out.roughness = 0.2;
      out.metalness = 0;
      return;
    }
    const [r, g, b] = mix3(112, 24, 198, 232, 118, 255, swirl * 0.6 + shimmer * 0.4);
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = 255;
    out.height = 0.5 + swirl * 0.4;
    out.roughness = 0.15;
    out.metalness = 0.1;
    out.er = Math.round(r * 0.92);
    out.eg = Math.round(g * 0.72);
    out.eb = Math.round(b * 0.98);
  });

  albedoCtx.putImageData(albedoImg, 0, 0);
  normalCtx.putImageData(normalImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  metalCtx.putImageData(metalImg, 0, 0);
  emissiveCtx.putImageData(emissiveImg, 0, 0);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const makeColorTex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    return t;
  };

  const makeDataTex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = maxAniso;
    t.needsUpdate = true;
    return t;
  };

  const opaqueTexture = makeColorTex(albedoCanvas);
  const cutoutTexture = makeColorTex(albedoCanvas);
  const normalTexture = makeDataTex(normalCanvas);
  const roughnessTexture = makeDataTex(roughCanvas);
  const metalnessTexture = makeDataTex(metalCanvas);
  const emissiveTexture = makeColorTex(emissiveCanvas);

  // Tileable 128x128 Water Albedo + Water Ripple Normal Map
  const waterSize = 128;
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = waterSize;
  waterCanvas.height = waterSize;
  const wCtx = waterCanvas.getContext('2d')!;
  const wImg = wCtx.createImageData(waterSize, waterSize);

  const wNormCanvas = document.createElement('canvas');
  wNormCanvas.width = waterSize;
  wNormCanvas.height = waterSize;
  const wnCtx = wNormCanvas.getContext('2d')!;
  const wnImg = wnCtx.createImageData(waterSize, waterSize);

  const wHeight = new Float32Array(waterSize * waterSize);
  for (let y = 0; y < waterSize; y++) {
    for (let x = 0; x < waterSize; x++) {
      const u = (x / waterSize) * Math.PI * 2;
      const v = (y / waterSize) * Math.PI * 2;
      const h =
        Math.sin(u * 2 + v * 1) * 0.32 +
        Math.cos(u * 3 - v * 2) * 0.25 +
        Math.sin(u * 5 + v * 4) * 0.14 +
        Math.cos(u * 7 - v * 6) * 0.08;
      wHeight[y * waterSize + x] = h;
      const [r, g, b] = mix3(20, 88, 152, 66, 156, 212, h * 0.4 + 0.5);
      const idx = (y * waterSize + x) * 4;
      wImg.data[idx] = r;
      wImg.data[idx + 1] = g;
      wImg.data[idx + 2] = b;
      wImg.data[idx + 3] = 255;
    }
  }
  for (let y = 0; y < waterSize; y++) {
    for (let x = 0; x < waterSize; x++) {
      const xm = (x - 1 + waterSize) % waterSize;
      const xp = (x + 1) % waterSize;
      const ym = (y - 1 + waterSize) % waterSize;
      const yp = (y + 1) % waterSize;
      const dhdx = (wHeight[y * waterSize + xp] - wHeight[y * waterSize + xm]) * 1.9;
      const dhdy = (wHeight[yp * waterSize + x] - wHeight[ym * waterSize + x]) * 1.9;
      const nx = -dhdx;
      const ny = dhdy;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      const idx = (y * waterSize + x) * 4;
      wnImg.data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      wnImg.data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      wnImg.data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      wnImg.data[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  wnCtx.putImageData(wnImg, 0, 0);

  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.colorSpace = THREE.SRGBColorSpace;
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.magFilter = THREE.LinearFilter;
  waterTexture.minFilter = THREE.LinearFilter;
  waterTexture.generateMipmaps = false;
  waterTexture.needsUpdate = true;

  const waterNormalTexture = new THREE.CanvasTexture(wNormCanvas);
  waterNormalTexture.wrapS = THREE.RepeatWrapping;
  waterNormalTexture.wrapT = THREE.RepeatWrapping;
  waterNormalTexture.magFilter = THREE.LinearFilter;
  waterNormalTexture.minFilter = THREE.LinearFilter;
  waterNormalTexture.generateMipmaps = false;
  waterNormalTexture.needsUpdate = true;

  // Procedural Realistic Cratered Moon Texture
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = 128;
  moonCanvas.height = 128;
  const moonCtx = moonCanvas.getContext('2d')!;
  const moonImg = moonCtx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const n = fbmTile(x * 0.08, y * 0.08, 901, 4);
      const maria = fbmTile(x * 0.035, y * 0.035, 902, 3);
      const crater = fbmTile(x * 0.2, y * 0.2, 903, 2);
      let lum = 188 + n * 52 - (maria > 0.54 ? (maria - 0.54) * 140 : 0);
      if (crater > 0.72) lum -= 24;
      const idx = (y * 128 + x) * 4;
      moonImg.data[idx] = clamp255(lum * 0.96);
      moonImg.data[idx + 1] = clamp255(lum * 0.98);
      moonImg.data[idx + 2] = clamp255(lum * 1.04);
      moonImg.data[idx + 3] = 255;
    }
  }
  moonCtx.putImageData(moonImg, 0, 0);
  const moonTexture = new THREE.CanvasTexture(moonCanvas);
  moonTexture.colorSpace = THREE.SRGBColorSpace;
  moonTexture.needsUpdate = true;

  // Crisp Square Blocky Grass Tuft Cutout Texture (64x64 pixel blade cluster)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 64;
  grassCanvas.height = 64;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 11; i++) {
    const bx = Math.round((6 + i * 4.8 + (pxHash(i, 1, 777) - 0.5) * 3) / 4) * 4;
    const h = Math.round((24 + pxHash(i, 2, 777) * 32) / 4) * 4;
    const stepShift = pxHash(i, 3, 777) > 0.5 ? 4 : -4;
    for (let sy = 4; sy <= h; sy += 4) {
      const t = sy / h;
      const sx = bx + (t > 0.55 ? stepShift : 0);
      gCtx.fillStyle = t < 0.35 ? '#366824' : t < 0.72 ? '#5da338' : '#98cf5c';
      gCtx.fillRect(sx, 64 - sy, 4, 4);
    }
  }
  const grassBladeTexture = new THREE.CanvasTexture(grassCanvas);
  grassBladeTexture.colorSpace = THREE.SRGBColorSpace;
  grassBladeTexture.magFilter = THREE.NearestFilter;
  grassBladeTexture.needsUpdate = true;

  // Crisp Square Glow Mote Texture (pollen/fireflies)
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 16;
  moteCanvas.height = 16;
  const moCtx = moteCanvas.getContext('2d')!;
  moCtx.fillStyle = 'rgba(255,250,210,0.45)';
  moCtx.fillRect(2, 2, 12, 12);
  moCtx.fillStyle = 'rgba(255,255,255,1)';
  moCtx.fillRect(4, 4, 8, 8);
  const moteTexture = new THREE.CanvasTexture(moteCanvas);
  moteTexture.colorSpace = THREE.SRGBColorSpace;
  moteTexture.magFilter = THREE.NearestFilter;
  moteTexture.needsUpdate = true;

  // Crisp Square Ground Contact Shadow Texture
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 32;
  shCanvas.height = 32;
  const sCtx = shCanvas.getContext('2d')!;
  sCtx.fillStyle = 'rgba(0,0,0,0.18)';
  sCtx.fillRect(2, 2, 28, 28);
  sCtx.fillStyle = 'rgba(0,0,0,0.34)';
  sCtx.fillRect(6, 6, 20, 20);
  const shadowDiscTexture = new THREE.CanvasTexture(shCanvas);
  shadowDiscTexture.magFilter = THREE.NearestFilter;
  shadowDiscTexture.needsUpdate = true;

  // 10-stage block breaking crack textures
  const crackTextures: THREE.CanvasTexture[] = [];
  for (let stage = 0; stage < 10; stage++) {
    const cCanvas = document.createElement('canvas');
    cCanvas.width = 32;
    cCanvas.height = 32;
    const cctx = cCanvas.getContext('2d')!;
    cctx.clearRect(0, 0, 32, 32);
    cctx.strokeStyle = 'rgba(10,10,12,0.82)';
    cctx.lineWidth = 1.6;
    const numCracks = (stage + 1) * 3;
    for (let i = 0; i < numCracks; i++) {
      const angle = pxHash(i, stage, 123) * Math.PI * 2;
      const len = 3 + pxHash(stage, i, 456) * (stage * 1.4 + 4);
      cctx.beginPath();
      cctx.moveTo(16, 16);
      const mx = 16 + Math.cos(angle + 0.2) * len * 0.55;
      const my = 16 + Math.sin(angle + 0.2) * len * 0.55;
      const ex = 16 + Math.cos(angle) * len;
      const ey = 16 + Math.sin(angle) * len;
      cctx.lineTo(mx, my);
      cctx.lineTo(ex, ey);
      cctx.stroke();
    }
    const ct = new THREE.CanvasTexture(cCanvas);
    ct.magFilter = THREE.LinearFilter;
    ct.minFilter = THREE.LinearFilter;
    ct.generateMipmaps = false;
    ct.needsUpdate = true;
    crackTextures.push(ct);
  }

  // Build native 16px-per-tile Square Voxel Texture Pack Atlas incorporating generateBlockTextures()
  const squareNativeCanvas = document.createElement('canvas');
  squareNativeCanvas.width = ATLAS_GRID * 16;
  squareNativeCanvas.height = ATLAS_GRID * 16;

  const squareAtlasCanvas = document.createElement('canvas');
  squareAtlasCanvas.width = ATLAS_PX;
  squareAtlasCanvas.height = ATLAS_PX;

  paintSquarePackAtlas(albedoCanvas, squareNativeCanvas, squareAtlasCanvas);

  const makeSquareTex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const squareOpaqueTexture = makeSquareTex(squareNativeCanvas);
  const squareCutoutTexture = makeSquareTex(squareNativeCanvas);

  return {
    opaqueTexture,
    cutoutTexture,
    squareOpaqueTexture,
    squareCutoutTexture,
    normalTexture,
    roughnessTexture,
    metalnessTexture,
    emissiveTexture,
    waterTexture,
    waterNormalTexture,
    moonTexture,
    grassBladeTexture,
    moteTexture,
    shadowDiscTexture,
    crackTextures,
    atlasCanvas: albedoCanvas,
    squareAtlasCanvas,
    squareNativeCanvas,
  };
}

export function buildStyledResourceAtlas(
  sourceCanvas: HTMLCanvasElement,
  pack: TexturePackId,
  maxAnisotropy = 4
): {
  canvas: HTMLCanvasElement;
  opaqueTexture: THREE.CanvasTexture;
  cutoutTexture: THREE.CanvasTexture;
} {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0);

  if (pack !== 'pbr' && pack !== 'square') {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 8) continue;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const isGreenish = g > r * 1.12 && g > b * 1.1;
      const isWarmWood = r > g * 1.08 && g >= b * 1.1 && r > 70;
      const isCyanAccent = b > r * 1.15 && g > r * 1.15;

      if (pack === 'neon_cyber') {
        const px = (i >> 2) % w;
        const py = Math.floor((i >> 2) / w);
        const gridEdge = px % 32 === 0 || py % 32 === 0;
        if (isCyanAccent) {
          r = 0;
          g = 245;
          b = 225;
        } else if (isGreenish) {
          r = clamp255(25 + lum * 40);
          g = clamp255(190 + lum * 65);
          b = clamp255(200 + lum * 55);
        } else if (isWarmWood) {
          r = clamp255(85 + lum * 130);
          g = clamp255(22 + lum * 55);
          b = clamp255(135 + lum * 105);
        } else {
          r = clamp255(16 + lum * 54 + (gridEdge ? 48 : 0));
          g = clamp255(20 + lum * 62 + (gridEdge ? 72 : 0));
          b = clamp255(36 + lum * 88 + (gridEdge ? 95 : 0));
        }
      } else if (pack === 'candy_pastel') {
        if (isGreenish) {
          r = clamp255(125 + lum * 95);
          g = clamp255(220 + lum * 35);
          b = clamp255(175 + lum * 65);
        } else if (isWarmWood) {
          r = clamp255(215 + lum * 40);
          g = clamp255(140 + lum * 80);
          b = clamp255(180 + lum * 65);
        } else {
          r = clamp255(r * 0.62 + 95);
          g = clamp255(g * 0.56 + 96);
          b = clamp255(b * 0.64 + 102);
        }
      } else if (pack === 'golden_royal') {
        if (isGreenish) {
          r = clamp255(r * 0.85 + 32);
          g = clamp255(g * 1.05 + 14);
          b = clamp255(b * 0.65);
        } else if (isWarmWood) {
          r = clamp255(r * 1.16 + 24);
          g = clamp255(g * 0.94 + 12);
          b = clamp255(b * 0.58);
        } else {
          r = clamp255(lum * 238 + 20);
          g = clamp255(lum * 206 + 16);
          b = clamp255(lum * 144 + 8);
        }
      } else if (pack === 'crimson_nether') {
        if (isGreenish) {
          r = clamp255(155 + lum * 95);
          g = clamp255(24 + lum * 48);
          b = clamp255(34 + lum * 36);
        } else if (isWarmWood) {
          r = clamp255(95 + lum * 115);
          g = clamp255(30 + lum * 45);
          b = clamp255(28 + lum * 32);
        } else {
          r = clamp255(52 + lum * 110);
          g = clamp255(26 + lum * 58);
          b = clamp255(30 + lum * 62);
        }
      } else if (pack === 'frost_tundra') {
        if (isGreenish) {
          r = clamp255(145 + lum * 105);
          g = clamp255(205 + lum * 48);
          b = clamp255(235 + lum * 20);
        } else if (isWarmWood) {
          r = clamp255(r * 0.65 + 75);
          g = clamp255(g * 0.72 + 88);
          b = clamp255(b * 0.88 + 98);
        } else {
          r = clamp255(lum * 165 + 58);
          g = clamp255(lum * 190 + 62);
          b = clamp255(lum * 215 + 75);
        }
      } else if (pack === 'noir_emerald') {
        if (isGreenish || isCyanAccent) {
          r = clamp255(18 + lum * 42);
          g = clamp255(150 + lum * 95);
          b = clamp255(98 + lum * 72);
        } else if (r > g * 1.25 && g > b * 1.15 && lum > 0.52) {
          // Keep gold/torch warmth in comic noir!
          r = clamp255(225 + lum * 30);
          g = clamp255(170 + lum * 55);
          b = clamp255(35);
        } else {
          const contrast = Math.max(0, Math.min(255, (lum - 0.5) * 1.35 * 255 + 128));
          r = contrast;
          g = contrast;
          b = contrast;
        }
      }

      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
  }

  const makeTex = (nearest: boolean) => {
    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    tex.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = !nearest;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const nearest = pack === 'square' || pack === 'noir_emerald';
  return {
    canvas: out,
    opaqueTexture: makeTex(nearest),
    cutoutTexture: makeTex(true),
  };
}

// Generate crisp 32x32 UI icon data URLs for every BlockId
const iconCache = new Map<BlockId, string>();

export function clearItemIconCache() {
  iconCache.clear();
}

export function getItemIconUrl(id: BlockId, atlasCanvas?: HTMLCanvasElement): string {
  if (iconCache.has(id)) return iconCache.get(id)!;

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const def = BLOCK_DEFS[id];
  if (!def) return '';

  if (def.isBlock && atlasCanvas && def.texSide !== undefined) {
    const topIdx = def.texTop ?? def.texSide;
    const sideIdx = def.texSide;

    const extractTile = (idx: number) => {
      const tx = (idx % ATLAS_GRID) * TILE_PX;
      const ty = Math.floor(idx / ATLAS_GRID) * TILE_PX;
      const tc = document.createElement('canvas');
      tc.width = 32;
      tc.height = 32;
      const tCtx = tc.getContext('2d')!;
      tCtx.imageSmoothingEnabled = false;
      tCtx.drawImage(atlasCanvas, tx, ty, TILE_PX, TILE_PX, 0, 0, 32, 32);
      return tc;
    };

    const topTile = extractTile(topIdx);
    const sideTile = extractTile(sideIdx);

    if (id === BlockId.TORCH || id === BlockId.GLOW_VINE) {
      ctx.drawImage(sideTile, 0, 0, 32, 32, 0, 0, 32, 32);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(29, 9);
      ctx.lineTo(16, 16);
      ctx.lineTo(3, 9);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.setTransform(0.406, 0.218, -0.406, 0.218, 16, 2);
      ctx.drawImage(topTile, 0, 0, 32, 32);
      ctx.restore();

      ctx.save();
      ctx.setTransform(0.406, 0.218, 0, 0.437, 3, 9);
      ctx.drawImage(sideTile, 0, 0, 32, 32);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, 0, 32, 32);
      ctx.restore();

      ctx.save();
      ctx.setTransform(0.406, -0.218, 0, 0.437, 16, 16);
      ctx.drawImage(sideTile, 0, 0, 32, 32);
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(0, 0, 32, 32);
      ctx.restore();
      ctx.restore();
    }
  } else {
    ctx.imageSmoothingEnabled = false;
    const p = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x * 2, y * 2, w * 2, h * 2);
    };

    const drawPickaxe = (headCol: string, headHi: string) => {
      for (let i = 0; i < 10; i++) p(3 + i, 12 - i, 1, 1, '#7a5228');
      for (let i = 0; i < 9; i++) p(4 + i, 12 - i, 1, 1, '#5e3c1b');
      p(6, 2, 6, 1, headHi);
      p(5, 3, 8, 1, headCol);
      p(11, 4, 2, 4, headCol);
      p(12, 5, 1, 5, shadeHex(headCol, 0.8));
      p(4, 3, 2, 2, headCol);
    };

    const drawSword = (bladeCol: string, bladeHi: string) => {
      for (let i = 0; i < 8; i++) {
        p(6 + i, 9 - i, 2, 2, bladeCol);
        p(7 + i, 9 - i, 1, 1, bladeHi);
      }
      p(4, 9, 4, 1, '#5c3c1e');
      p(6, 11, 1, 2, '#5c3c1e');
      p(3, 12, 2, 2, '#7d532b');
      p(2, 13, 2, 2, '#472c15');
    };

    const drawAxe = (headCol: string, headHi: string) => {
      for (let i = 0; i < 10; i++) p(3 + i, 12 - i, 1, 1, '#7a5228');
      p(8, 2, 5, 2, headHi);
      p(7, 3, 6, 3, headCol);
      p(9, 6, 3, 2, shadeHex(headCol, 0.85));
    };

    const drawShovel = (headCol: string, headHi: string) => {
      for (let i = 0; i < 9; i++) p(3 + i, 12 - i, 1, 1, '#7a5228');
      p(10, 2, 4, 4, headCol);
      p(11, 2, 3, 2, headHi);
    };

    const drawHelmet = (col: string, hi: string) => {
      const dark = shadeHex(col, 0.72);
      p(4, 3, 8, 2, hi);
      p(3, 5, 10, 6, col);
      p(3, 10, 3, 2, dark);
      p(10, 10, 3, 2, dark);
      ctx.clearRect(6 * 2, 8 * 2, 4 * 2, 3 * 2);
      p(5, 4, 2, 2, hi);
    };

    const drawChestplate = (col: string, hi: string) => {
      const dark = shadeHex(col, 0.74);
      p(2, 3, 4, 5, col);
      p(10, 3, 4, 5, col);
      p(3, 3, 3, 2, hi);
      p(10, 3, 3, 2, hi);
      p(5, 4, 6, 9, col);
      p(6, 5, 4, 2, hi);
      p(5, 11, 6, 2, dark);
      ctx.clearRect(6 * 2, 3 * 2, 4 * 2, 2 * 2);
    };

    const drawLeggings = (col: string, hi: string) => {
      const dark = shadeHex(col, 0.72);
      p(4, 2, 8, 3, hi);
      p(4, 4, 8, 3, col);
      p(4, 7, 3, 7, col);
      p(9, 7, 3, 7, col);
      p(4, 12, 3, 2, dark);
      p(9, 12, 3, 2, dark);
    };

    const drawBoots = (col: string, hi: string) => {
      const dark = shadeHex(col, 0.72);
      p(3, 6, 3, 6, col);
      p(2, 11, 5, 3, dark);
      p(3, 6, 2, 2, hi);
      p(10, 6, 3, 6, col);
      p(9, 11, 5, 3, dark);
      p(10, 6, 2, 2, hi);
    };

    switch (id) {
      case BlockId.STICK:
        for (let i = 0; i < 10; i++) {
          p(3 + i, 12 - i, 2, 1, '#8c6032');
          p(3 + i, 11 - i, 1, 1, '#684420');
        }
        break;
      case BlockId.COAL:
        p(4, 4, 8, 8, '#232528');
        p(5, 3, 5, 10, '#2d3035');
        p(6, 5, 3, 2, '#454950');
        break;
      case BlockId.IRON_INGOT:
        p(3, 6, 10, 5, '#c7c7c7');
        p(4, 5, 8, 2, '#f0f0f0');
        p(4, 10, 8, 1, '#8c8c8c');
        break;
      case BlockId.GOLD_INGOT:
        p(3, 6, 10, 5, '#e8b923');
        p(4, 5, 8, 2, '#fff078');
        p(4, 10, 8, 1, '#a87d0e');
        break;
      case BlockId.DIAMOND:
        p(5, 3, 6, 10, '#3be0eb');
        p(3, 5, 10, 6, '#26b6c4');
        p(5, 5, 4, 3, '#a8fbff');
        break;
      case BlockId.EMERALD:
        p(5, 3, 6, 10, '#2ad45c');
        p(4, 4, 8, 8, '#1da846');
        p(5, 5, 3, 4, '#9bffb8');
        break;
      case BlockId.BONE:
        for (let i = 0; i < 8; i++) p(4 + i, 11 - i, 2, 2, '#eee8d8');
        p(2, 11, 3, 3, '#ded7c4');
        p(11, 2, 3, 3, '#ffffff');
        break;
      case BlockId.STRING:
        p(4, 4, 8, 8, '#e8ecee');
        p(5, 5, 6, 6, '#c2c8cc');
        p(6, 6, 4, 4, '#ffffff');
        break;
      case BlockId.FEATHER:
        for (let i = 0; i < 9; i++) p(4 + i, 11 - i, 1, 1, '#a08c70');
        for (let i = 0; i < 6; i++) p(7 + i, 8 - i, 3, 3, '#f7f7f2');
        break;
      case BlockId.LEATHER:
        p(3, 4, 10, 8, '#9c522b');
        p(4, 5, 8, 6, '#b8663a');
        p(5, 4, 6, 1, '#75391b');
        break;
      case BlockId.GUNPOWDER:
        p(4, 6, 8, 6, '#50545a');
        p(5, 4, 6, 4, '#6d727a');
        p(6, 7, 4, 3, '#383b40');
        break;
      case BlockId.FLINT:
        p(5, 4, 6, 8, '#2b2d34');
        p(4, 6, 8, 5, '#1c1e24');
        p(6, 5, 3, 4, '#545864');
        break;
      case BlockId.FLINT_AND_STEEL:
        // Curved steel striker + flint sparker
        p(3, 6, 3, 6, '#b8c0cc');
        p(5, 4, 5, 3, '#e2e8f0');
        p(3, 10, 5, 3, '#94a3b8');
        p(10, 7, 4, 5, '#3b3e47');
        p(9, 9, 2, 2, '#f97316');
        break;
      case BlockId.NETHER_QUARTZ:
        p(5, 3, 6, 10, '#e8e2d8');
        p(4, 5, 8, 6, '#ffffff');
        p(6, 5, 3, 5, '#d4cdc0');
        break;
      case BlockId.WOOD_PICKAXE:
        drawPickaxe('#9e7440', '#bf9256');
        break;
      case BlockId.STONE_PICKAXE:
        drawPickaxe('#85898f', '#adb1b8');
        break;
      case BlockId.IRON_PICKAXE:
        drawPickaxe('#d0d5db', '#ffffff');
        break;
      case BlockId.GOLD_PICKAXE:
        drawPickaxe('#e8b923', '#fff078');
        break;
      case BlockId.DIAMOND_PICKAXE:
        drawPickaxe('#2dd3e0', '#96f7ff');
        break;
      case BlockId.WOOD_SWORD:
        drawSword('#9e7440', '#bf9256');
        break;
      case BlockId.STONE_SWORD:
        drawSword('#85898f', '#adb1b8');
        break;
      case BlockId.IRON_SWORD:
        drawSword('#d0d5db', '#ffffff');
        break;
      case BlockId.GOLD_SWORD:
        drawSword('#e8b923', '#fff078');
        break;
      case BlockId.DIAMOND_SWORD:
        drawSword('#2dd3e0', '#96f7ff');
        break;
      case BlockId.WOOD_AXE:
        drawAxe('#9e7440', '#bf9256');
        break;
      case BlockId.STONE_AXE:
        drawAxe('#85898f', '#adb1b8');
        break;
      case BlockId.IRON_AXE:
        drawAxe('#d0d5db', '#ffffff');
        break;
      case BlockId.GOLD_AXE:
        drawAxe('#e8b923', '#fff078');
        break;
      case BlockId.DIAMOND_AXE:
        drawAxe('#2dd3e0', '#96f7ff');
        break;
      case BlockId.WOOD_SHOVEL:
        drawShovel('#9e7440', '#bf9256');
        break;
      case BlockId.STONE_SHOVEL:
        drawShovel('#85898f', '#adb1b8');
        break;
      case BlockId.IRON_SHOVEL:
        drawShovel('#d0d5db', '#ffffff');
        break;
      case BlockId.GOLD_SHOVEL:
        drawShovel('#e8b923', '#fff078');
        break;
      case BlockId.DIAMOND_SHOVEL:
        drawShovel('#2dd3e0', '#96f7ff');
        break;
      case BlockId.APPLE:
        p(7, 2, 1, 2, '#5a3a1a');
        p(8, 2, 2, 1, '#4ca333');
        p(4, 4, 8, 9, '#d62828');
        p(3, 6, 10, 5, '#c41e1e');
        p(5, 5, 2, 3, '#ff6b6b');
        break;
      case BlockId.GOLDEN_APPLE:
        p(7, 2, 1, 2, '#5a3a1a');
        p(8, 2, 2, 1, '#78e04b');
        p(4, 4, 8, 9, '#e8b923');
        p(3, 6, 10, 5, '#d19a15');
        p(5, 5, 2, 3, '#fff6a6');
        break;
      case BlockId.BREAD:
        p(3, 6, 10, 5, '#c9883b');
        p(4, 5, 8, 2, '#e8ad5a');
        p(6, 5, 1, 2, '#8c5319');
        p(10, 5, 1, 2, '#8c5319');
        break;
      case BlockId.RAW_PORK:
        p(3, 5, 10, 6, '#e07a7a');
        p(4, 6, 6, 4, '#f09d9d');
        p(10, 6, 2, 3, '#fff0f0');
        break;
      case BlockId.COOKED_PORK:
        p(3, 5, 10, 6, '#8a4822');
        p(4, 6, 7, 4, '#b56735');
        p(10, 6, 2, 2, '#e6b88a');
        break;
      case BlockId.RAW_BEEF:
        p(3, 5, 10, 6, '#b82828');
        p(5, 6, 6, 4, '#d94848');
        p(9, 6, 2, 2, '#f5d8d8');
        break;
      case BlockId.STEAK:
        p(3, 5, 10, 6, '#6e2e1e');
        p(5, 6, 6, 4, '#964430');
        p(9, 6, 2, 2, '#c9907c');
        break;
      case BlockId.RAW_CHICKEN:
        p(4, 5, 8, 6, '#f2c8b6');
        p(5, 6, 5, 4, '#ffdcd0');
        p(11, 6, 2, 2, '#ffffff');
        break;
      case BlockId.COOKED_CHICKEN:
        p(4, 5, 8, 6, '#c77a32');
        p(5, 6, 5, 4, '#e39a4f');
        p(11, 6, 2, 2, '#f2e8dc');
        break;
      case BlockId.LEATHER_HELMET:
        drawHelmet('#9c522b', '#b8663a');
        break;
      case BlockId.LEATHER_CHESTPLATE:
        drawChestplate('#9c522b', '#b8663a');
        break;
      case BlockId.LEATHER_LEGGINGS:
        drawLeggings('#9c522b', '#b8663a');
        break;
      case BlockId.LEATHER_BOOTS:
        drawBoots('#9c522b', '#b8663a');
        break;
      case BlockId.IRON_HELMET:
        drawHelmet('#c7ccd1', '#ffffff');
        break;
      case BlockId.IRON_CHESTPLATE:
        drawChestplate('#c7ccd1', '#ffffff');
        break;
      case BlockId.IRON_LEGGINGS:
        drawLeggings('#c7ccd1', '#ffffff');
        break;
      case BlockId.IRON_BOOTS:
        drawBoots('#c7ccd1', '#ffffff');
        break;
      case BlockId.GOLD_HELMET:
        drawHelmet('#e8b923', '#fff078');
        break;
      case BlockId.GOLD_CHESTPLATE:
        drawChestplate('#e8b923', '#fff078');
        break;
      case BlockId.GOLD_LEGGINGS:
        drawLeggings('#e8b923', '#fff078');
        break;
      case BlockId.GOLD_BOOTS:
        drawBoots('#e8b923', '#fff078');
        break;
      case BlockId.DIAMOND_HELMET:
        drawHelmet('#2dd3e0', '#96f7ff');
        break;
      case BlockId.DIAMOND_CHESTPLATE:
        drawChestplate('#2dd3e0', '#96f7ff');
        break;
      case BlockId.DIAMOND_LEGGINGS:
        drawLeggings('#2dd3e0', '#96f7ff');
        break;
      case BlockId.DIAMOND_BOOTS:
        drawBoots('#2dd3e0', '#96f7ff');
        break;
      default:
        p(4, 4, 8, 8, '#cccccc');
    }
  }

  const url = canvas.toDataURL();
  iconCache.set(id, url);
  return url;
}
