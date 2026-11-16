import * as THREE from 'three';
import { hash2D, SeededNoise } from './noise';
import { PARKOUR_100_LEVELS } from './parkour100';
import { ATLAS_GRID } from './textures';
import { BlockId, BLOCK_DEFS, DimensionId, WorldType } from './types';
import { WOULD_YOU_RATHER_LEVELS, WYR_FINISH_Y, WYR_FINISH_Z0, WYR_FINISH_Z1 } from './wouldYouRather100';

export const CHUNK_W = 16;
export const CHUNK_H = 64;
export const CHUNK_D = 16;
export const SEA_LEVEL = 22;
export const NETHER_LAVA_LEVEL = 14;

export type BiomeType = 'Plains' | 'Oak Forest' | 'Desert' | 'Alpine Peaks' | 'Ocean';
export type CaveBiomeType = 'Deep Hollows' | 'Lush Cavern' | 'Crystal Cavern' | 'Dripstone Caves';
export type NetherBiomeType = 'Nether Wastes' | 'Soul Sand Valley' | 'Nether Fortress';

export interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  opaqueMesh: THREE.Mesh | null;
  cutoutMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dirty: boolean;
}

const FACE_DIRS: {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvs: [number, number][];
  shade: number;
  faceType: 'top' | 'bottom' | 'side';
}[] = [
  // +Y Top
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 1.0,
    faceType: 'top',
  },
  // -Y Bottom
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.58,
    faceType: 'bottom',
  },
  // +X East
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.8,
    faceType: 'side',
  },
  // -X West
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.8,
    faceType: 'side',
  },
  // +Z South
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.88,
    faceType: 'side',
  },
  // -Z North
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.88,
    faceType: 'side',
  },
];

const AO_CURVE = [0.46, 0.66, 0.84, 1.0];

export class VoxelWorld {
  public noise: SeededNoise;
  public worldType: WorldType;
  public dimension: DimensionId;
  public chunks = new Map<string, ChunkData>();
  public modifiedBlocks = new Map<string, BlockId>();
  public group = new THREE.Group();

  private opaqueMat: THREE.MeshStandardMaterial;
  private cutoutMat: THREE.MeshStandardMaterial;
  private waterMat: THREE.MeshStandardMaterial;

  constructor(
    seed: string | number,
    opaqueMat: THREE.MeshStandardMaterial,
    cutoutMat: THREE.MeshStandardMaterial,
    waterMat: THREE.MeshStandardMaterial,
    worldType: WorldType = 'normal',
    dimension: DimensionId = 'overworld'
  ) {
    this.noise = new SeededNoise(seed);
    this.worldType = worldType;
    this.dimension = dimension;
    this.opaqueMat = opaqueMat;
    this.cutoutMat = cutoutMat;
    this.waterMat = waterMat;
  }

  public chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public blockIndex(lx: number, y: number, lz: number): number {
    return (y * CHUNK_D + lz) * CHUNK_W + lx;
  }

  public getBiomeAt(
    wx: number,
    wz: number
  ): { biome: BiomeType | 'Skyblock' | 'One Block' | 'Tutorial Camp' | 'Parkour Course' | '100-Level Parkour' | 'Would You Rather'; temp: number; moisture: number; height: number } {
    if (this.worldType === 'oneblock') {
      return { biome: 'One Block', temp: 0.3, moisture: 0.35, height: 33 };
    }
    if (this.worldType === 'wouldyourather') {
      return { biome: 'Would You Rather', temp: 0.35, moisture: 0.3, height: 32 };
    }
    if (this.worldType === 'skyblock') {
      return { biome: 'Skyblock', temp: 0.25, moisture: 0.3, height: 33 };
    }
    if (this.worldType === 'tutorial') {
      return { biome: 'Tutorial Camp', temp: 0.3, moisture: 0.4, height: 26 };
    }
    if (this.worldType === 'parkour') {
      return { biome: 'Parkour Course', temp: 0.35, moisture: 0.25, height: 32 };
    }
    if (this.worldType === 'parkour100') {
      return { biome: '100-Level Parkour', temp: 0.35, moisture: 0.25, height: 32 };
    }
    const temp = this.noise.fbm2D(wx * 0.0045, wz * 0.0045, 3, 0.5, 2.0, 11);
    const moisture = this.noise.fbm2D(wx * 0.005, wz * 0.005, 3, 0.5, 2.0, 29);
    const cont = this.noise.fbm2D(wx * 0.006, wz * 0.006, 4, 0.52, 2.0, 47);
    const detail = this.noise.fbm2D(wx * 0.025, wz * 0.025, 3, 0.5, 2.0, 73);
    const ridge = 1 - Math.abs(this.noise.noise2D(wx * 0.014, wz * 0.014, 97));

    let baseH = 26 + cont * 14 + detail * 4;
    let biome: BiomeType = 'Plains';

    if (cont < -0.22) {
      biome = 'Ocean';
      baseH = SEA_LEVEL - 4 + cont * 12 + detail * 2;
    } else if (temp > 0.22 && moisture < 0.08) {
      biome = 'Desert';
      baseH = 24 + cont * 8 + detail * 3;
    } else if (cont > 0.24 || (ridge > 0.78 && cont > 0.05)) {
      biome = 'Alpine Peaks';
      baseH = 29 + cont * 20 + Math.pow(ridge, 2) * 16 + detail * 4;
    } else if (moisture > 0.08) {
      biome = 'Oak Forest';
      baseH = 26 + cont * 11 + detail * 4;
    }

    const height = Math.max(4, Math.min(CHUNK_H - 8, Math.round(baseH)));
    return { biome, temp, moisture, height };
  }

  public getCaveBiomeAt(wx: number, wz: number): CaveBiomeType {
    const caveHum = this.noise.fbm2D(wx * 0.0085, wz * 0.0085, 3, 0.5, 2.0, 503);
    const caveTemp = this.noise.fbm2D(wx * 0.0085, wz * 0.0085, 3, 0.5, 2.0, 521);
    if (caveHum > 0.16) return 'Lush Cavern';
    if (caveTemp < -0.14) return 'Crystal Cavern';
    if (caveTemp > 0.15) return 'Dripstone Caves';
    return 'Deep Hollows';
  }

  public getNetherBiomeAt(wx: number, wz: number): NetherBiomeType {
    const fortBridgeZ = Math.abs(wz - 28) <= 8;
    const fortCrossX = Math.abs(wx) <= 7 && wz >= -12 && wz <= 56;
    if (fortBridgeZ || fortCrossX) return 'Nether Fortress';
    const heat = this.noise.fbm2D(wx * 0.007, wz * 0.007, 3, 0.5, 2.0, 811);
    return heat < -0.1 ? 'Soul Sand Valley' : 'Nether Wastes';
  }

  public getEffectiveBiomeAt(
    wx: number,
    wy: number,
    wz: number
  ): { biome: string; isUnderground: boolean; surfaceHeight: number } {
    if (this.dimension === 'nether') {
      return {
        biome: this.getNetherBiomeAt(wx, wz),
        isUnderground: true,
        surfaceHeight: CHUNK_H - 4,
      };
    }
    if (this.worldType === 'oneblock') {
      return {
        biome: 'One Block Sky',
        isUnderground: false,
        surfaceHeight: 33,
      };
    }
    if (this.worldType === 'skyblock') {
      return {
        biome: 'Skyblock Islands',
        isUnderground: false,
        surfaceHeight: 33,
      };
    }
    if (this.worldType === 'tutorial') {
      const inGrotto = wx >= 7 && wx <= 20 && wz >= 6 && wz <= 18 && wy < 25;
      return {
        biome: inGrotto ? 'Crystal Grotto' : 'Tutorial Camp',
        isUnderground: inGrotto,
        surfaceHeight: 26,
      };
    }
    if (this.worldType === 'parkour') {
      let stage = 'Stage 1: Meadow Steps';
      if (wz <= -123) stage = 'Diamond Summit';
      else if (wz <= -96) stage = 'Stage 4: Obsidian Sprint';
      else if (wz <= -65) stage = 'Stage 3: Crystal Spire';
      else if (wz <= -29) stage = 'Stage 2: Brick Leap';
      return {
        biome: stage,
        isUnderground: false,
        surfaceHeight: 32,
      };
    }
    if (this.worldType === 'wouldyourather') {
      if (wz <= WYR_FINISH_Z1) {
        return {
          biome: 'Champion Summit (100/100)',
          isUnderground: false,
          surfaceHeight: WYR_FINISH_Y + 1,
        };
      }
      let closest = WOULD_YOU_RATHER_LEVELS[0];
      let bestDist = Infinity;
      for (const lvl of WOULD_YOU_RATHER_LEVELS) {
        const czMid = (lvl.entryZ1 + lvl.exitZ0) * 0.5;
        const d = Math.abs(wz - czMid);
        if (d < bestDist) {
          bestDist = d;
          closest = lvl;
        }
      }
      const label =
        closest.level === 0
          ? 'Would You Rather · Start'
          : `Q${closest.level}/100 · ${closest.chapter}`;
      return {
        biome: label,
        isUnderground: false,
        surfaceHeight: closest.y + 1,
      };
    }
    if (this.worldType === 'parkour100') {
      let closest = PARKOUR_100_LEVELS[0];
      let bestDist = Infinity;
      for (const lvl of PARKOUR_100_LEVELS) {
        const czMid = (lvl.z0 + lvl.z1) * 0.5;
        const d = Math.abs(wz - czMid);
        if (d < bestDist) {
          bestDist = d;
          closest = lvl;
        }
      }
      const label =
        closest.level === 0
          ? '100-Lvl Parkour · Start'
          : `Level ${closest.level}/100 · ${closest.zone}`;
      return {
        biome: label,
        isUnderground: false,
        surfaceHeight: closest.y + 1,
      };
    }
    const surface = this.getBiomeAt(wx, wz);
    // Detect whether sky is occluded overhead and player is beneath natural surface terrain
    let roofHits = 0;
    const startY = Math.max(2, Math.floor(wy) + 2);
    for (let y = startY; y < Math.min(CHUNK_H, startY + 26); y++) {
      const id = this.getBlock(wx, y, wz);
      if (id !== BlockId.AIR && id !== BlockId.WATER && id !== BlockId.GLOW_VINE && id !== BlockId.LEAVES) {
        roofHits++;
        if (roofHits >= 2) break;
      }
    }
    const isUnderground = wy < surface.height - 2.5 && roofHits >= 2;
    return {
      biome: isUnderground ? this.getCaveBiomeAt(wx, wz) : surface.biome,
      isUnderground,
      surfaceHeight: surface.height,
    };
  }

  private hasTreeAt(wx: number, wz: number): { hasTree: boolean; type: 'oak' | 'cactus'; height: number } {
    const { biome, height } = this.getBiomeAt(wx, wz);
    if (height <= SEA_LEVEL + 1) return { hasTree: false, type: 'oak', height };

    const r = hash2D(wx, wz, this.noise.seed + 555);
    // Avoid trees directly adjacent by using local peak check
    if (biome === 'Oak Forest' && r > 0.968) {
      return { hasTree: true, type: 'oak', height };
    }
    if (biome === 'Plains' && r > 0.992) {
      return { hasTree: true, type: 'oak', height };
    }
    if (biome === 'Desert' && r > 0.991) {
      return { hasTree: true, type: 'cactus', height };
    }
    return { hasTree: false, type: 'oak', height };
  }

  public generateChunk(cx: number, cz: number): ChunkData {
    const key = this.chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D);
    const startX = cx * CHUNK_W;
    const startZ = cz * CHUNK_D;

    if (this.dimension === 'nether') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H - 1) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          const nBiome = this.getNetherBiomeAt(wx, wz);
          const floorH = Math.round(17 + this.noise.fbm2D(wx * 0.024, wz * 0.024, 3, 0.5, 2.0, 823) * 8);
          const ceilH = Math.round(52 + this.noise.fbm2D(wx * 0.02, wz * 0.02, 3, 0.5, 2.0, 839) * 6);

          for (let y = 0; y < CHUNK_H; y++) {
            const idx = this.blockIndex(lx, y, lz);
            if (y === 0 || y === CHUNK_H - 1) {
              blocks[idx] = BlockId.BEDROCK;
              continue;
            }
            if (y >= CHUNK_H - 4 && hash2D(wx + y, wz - y, 853) > 0.45) {
              blocks[idx] = BlockId.BEDROCK;
              continue;
            }

            // Carve huge vaulted Nether caverns between y = 10 and ceiling
            const cav3D = this.noise.fbm3D(wx * 0.032, y * 0.048, wz * 0.032, 3, 0.54, 2.0, 877);
            const midClear = y >= 15 && y <= 46 ? 0.28 : 0;
            const isOpenAir = y > floorH && y < ceilH ? cav3D + midClear > -0.18 : cav3D > 0.34;

            if (isOpenAir) {
              blocks[idx] = y <= NETHER_LAVA_LEVEL ? BlockId.LAVA : BlockId.AIR;
              continue;
            }

            if (y <= NETHER_LAVA_LEVEL && y > floorH - 2 && cav3D > 0.06) {
              blocks[idx] = BlockId.LAVA;
              continue;
            }

            const qNoise = this.noise.noise3D(wx * 0.24, y * 0.24, wz * 0.24, 907);
            const soulNoise = this.noise.noise2D(wx * 0.08, wz * 0.08, 919);

            if (
              nBiome === 'Soul Sand Valley' &&
              y >= floorH - 2 &&
              y <= floorH + 2 &&
              y >= NETHER_LAVA_LEVEL - 1
            ) {
              blocks[idx] = BlockId.SOUL_SAND;
            } else if (soulNoise > 0.48 && y >= NETHER_LAVA_LEVEL - 1 && y <= NETHER_LAVA_LEVEL + 2) {
              blocks[idx] = BlockId.SOUL_SAND;
            } else if (qNoise > 0.56 && hash2D(wx * 2 + y, wz - y, 929) > 0.35) {
              blocks[idx] = BlockId.QUARTZ_ORE;
            } else {
              blocks[idx] = BlockId.NETHERRACK;
            }
          }

          // Hanging Glowstone clusters under Nether ceilings
          const glowRoll = hash2D(wx, wz, this.noise.seed + 941);
          if (glowRoll > 0.985) {
            for (let y = CHUNK_H - 5; y >= 32; y--) {
              const b = blocks[this.blockIndex(lx, y, lz)];
              const below = blocks[this.blockIndex(lx, y - 1, lz)];
              if (b === BlockId.NETHERRACK && below === BlockId.AIR) {
                const stalLen = 2 + Math.floor(hash2D(wx + 3, wz + 7, 947) * 3);
                for (let d = 1; d <= stalLen && y - d > 20; d++) {
                  setWorldBlock(wx, y - d, wz, BlockId.GLOWSTONE);
                }
                break;
              }
            }
          }
        }
      }

      // Deterministic Nether Fortress elevated Nether Brick bridge along z = 28 (with blaze-style Glowstone pillars)
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          const onEastWestBridge = Math.abs(wz - 28) <= 2;
          const onNorthSouthBridge = Math.abs(wx) <= 2 && wz >= -8 && wz <= 52;
          if (!onEastWestBridge && !onNorthSouthBridge) continue;

          const bridgeY = 26;
          setWorldBlock(wx, bridgeY, wz, BlockId.NETHER_BRICKS);
          // Clear headroom above the bridge
          for (let hy = 1; hy <= 4; hy++) {
            setWorldBlock(wx, bridgeY + hy, wz, BlockId.AIR);
          }
          // Battlement railings along bridge edges
          const isEdgeZ = onEastWestBridge && Math.abs(wz - 28) === 2 && !onNorthSouthBridge;
          const isEdgeX = onNorthSouthBridge && Math.abs(wx) === 2 && !onEastWestBridge;
          if ((isEdgeZ && Math.abs(wx) % 2 === 0) || (isEdgeX && Math.abs(wz) % 2 === 0)) {
            setWorldBlock(wx, bridgeY + 1, wz, BlockId.NETHER_BRICKS);
          }
          // Glowstone lantern posts every 12 blocks
          if ((isEdgeZ && Math.abs(wx) % 12 === 0) || (isEdgeX && Math.abs(wz) % 12 === 0)) {
            setWorldBlock(wx, bridgeY + 2, wz, BlockId.GLOWSTONE);
          }
          // Support pillars extending down into lava/netherrack every 8 blocks
          if (Math.abs(wx) % 8 === 0 && (Math.abs(wz - 28) === 2 || (onNorthSouthBridge && Math.abs(wz) % 8 === 0 && Math.abs(wx) === 2))) {
            for (let py = bridgeY - 1; py >= 2; py--) {
              const existingAt = blocks[this.blockIndex(lx, py, lz)];
              if (existingAt === BlockId.NETHERRACK || existingAt === BlockId.BEDROCK) break;
              setWorldBlock(wx, py, wz, BlockId.NETHER_BRICKS);
            }
          }
        }
      }

      // Re-apply Nether player modifications
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const netherChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, netherChunk);
      return netherChunk;
    }

    if (this.worldType === 'oneblock') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      // The single eternal One Block at (0, 32, 0)
      setWorldBlock(0, 32, 0, BlockId.GRASS);

      // Scenic distant floating clouds outside spawn void
      if (Math.abs(cx) >= 2 || Math.abs(cz) >= 2) {
        const cloudRoll = hash2D(cx, cz, this.noise.seed + 919);
        if (cloudRoll > 0.72) {
          const icx = startX + 8;
          const icz = startZ + 8;
          const cy = 44 + Math.floor(hash2D(cx * 3, cz * 5, this.noise.seed + 929) * 14);
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;
              setWorldBlock(icx + dx, cy, icz + dz, BlockId.WOOL);
            }
          }
        }
      }

      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const oneBlockChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, oneBlockChunk);
      return oneBlockChunk;
    }

    if (this.worldType === 'skyblock') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      // 1. Starter Main Skyblock Island centered around (0, 32, 0)
      for (let wx = -3; wx <= 3; wx++) {
        for (let wz = -3; wz <= 3; wz++) {
          const dist = Math.abs(wx) + Math.abs(wz);
          if (dist > 4) continue;
          setWorldBlock(wx, 32, wz, BlockId.GRASS);
          setWorldBlock(wx, 31, wz, BlockId.DIRT);
          if (dist <= 3) setWorldBlock(wx, 30, wz, BlockId.DIRT);
          if (dist <= 2) setWorldBlock(wx, 29, wz, BlockId.STONE);
          if (dist <= 1) setWorldBlock(wx, 28, wz, BlockId.STONE);
        }
      }
      // Coal & Iron tucked inside island belly + recessed 2x1 spring + Chest + Torch
      setWorldBlock(0, 29, 0, BlockId.COAL_ORE);
      setWorldBlock(1, 29, 0, BlockId.IRON_ORE);
      setWorldBlock(1, 32, 2, BlockId.WATER);
      setWorldBlock(2, 32, 2, BlockId.WATER);
      setWorldBlock(2, 33, -1, BlockId.CHEST);
      setWorldBlock(1, 33, -2, BlockId.TORCH);

      // Starter Oak Tree at (-2, 33, -2)
      for (let dy = 0; dy < 5; dy++) {
        setWorldBlock(-2, 33 + dy, -2, BlockId.OAK_LOG);
      }
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy === 1 ? 1 : 2;
        const ly = 38 + dy;
        for (let ox = -rad; ox <= rad; ox++) {
          for (let oz = -rad; oz <= rad; oz++) {
            if (ox === 0 && oz === 0 && dy < 0) continue;
            if (Math.abs(ox) === rad && Math.abs(oz) === rad && dy === -2) continue;
            setWorldBlock(-2 + ox, ly, -2 + oz, BlockId.LEAVES);
          }
        }
      }

      // 2. East Desert & Cactus Island (x = 18..22, z = -2..2)
      for (let wx = 18; wx <= 22; wx++) {
        for (let wz = -2; wz <= 2; wz++) {
          const d = Math.abs(wx - 20) + Math.abs(wz);
          if (d > 3) continue;
          setWorldBlock(wx, 33, wz, BlockId.SAND);
          setWorldBlock(wx, 32, wz, BlockId.SANDSTONE);
          if (d <= 2) setWorldBlock(wx, 31, wz, BlockId.STONE);
          if (d <= 1) setWorldBlock(wx, 30, wz, BlockId.COAL_ORE);
        }
      }
      setWorldBlock(20, 34, 0, BlockId.CACTUS);
      setWorldBlock(20, 35, 0, BlockId.CACTUS);
      setWorldBlock(20, 36, 0, BlockId.CACTUS);
      setWorldBlock(19, 34, 1, BlockId.CHEST);
      setWorldBlock(19, 34, -1, BlockId.TORCH);

      // 3. North Miner's Ore Crag (x = -2..2, z = -22..-18)
      for (let wx = -2; wx <= 2; wx++) {
        for (let wz = -22; wz <= -18; wz++) {
          const d = Math.abs(wx) + Math.abs(wz + 20);
          if (d > 3) continue;
          setWorldBlock(wx, 35, wz, BlockId.STONE);
          setWorldBlock(wx, 34, wz, BlockId.DEEPSLATE);
          if (d <= 2) setWorldBlock(wx, 33, wz, BlockId.STONE);
          if (d <= 1) setWorldBlock(wx, 32, wz, BlockId.DIAMOND_ORE);
        }
      }
      setWorldBlock(0, 36, -20, BlockId.IRON_ORE);
      setWorldBlock(1, 36, -20, BlockId.GOLD_ORE);
      setWorldBlock(-1, 36, -20, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(0, 36, -19, BlockId.TORCH);

      // 4. West Lush Glow-Moss & Crystal Sanctuary (x = -24..-19, z = 3..8)
      for (let wx = -24; wx <= -19; wx++) {
        for (let wz = 3; wz <= 8; wz++) {
          const d = Math.abs(wx + 21.5) + Math.abs(wz - 5.5);
          if (d > 3.5) continue;
          setWorldBlock(wx, 36, wz, BlockId.CAVE_MOSS);
          setWorldBlock(wx, 35, wz, BlockId.DEEPSLATE);
          if (d <= 2.2) setWorldBlock(wx, 34, wz, BlockId.DRIPSTONE);
        }
      }
      setWorldBlock(-22, 37, 5, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(-21, 37, 6, BlockId.CRAFTING_TABLE);
      setWorldBlock(-21, 37, 5, BlockId.FURNACE);
      setWorldBlock(-23, 33, 5, BlockId.GLOW_VINE);
      setWorldBlock(-23, 32, 5, BlockId.GLOW_VINE);
      setWorldBlock(-20, 33, 6, BlockId.GLOW_VINE);

      // 5. South Obsidian & Emerald Spire (x = -2..2, z = 22..26)
      for (let wx = -2; wx <= 2; wx++) {
        for (let wz = 22; wz <= 26; wz++) {
          const d = Math.abs(wx) + Math.abs(wz - 24);
          if (d > 3) continue;
          setWorldBlock(wx, 34, wz, BlockId.OBSIDIAN);
          if (d <= 2) setWorldBlock(wx, 33, wz, BlockId.DEEPSLATE);
          if (d <= 1) setWorldBlock(wx, 32, wz, BlockId.EMERALD_ORE);
        }
      }
      setWorldBlock(0, 35, 24, BlockId.OBSIDIAN);
      setWorldBlock(0, 36, 24, BlockId.OBSIDIAN);
      setWorldBlock(0, 37, 24, BlockId.GLOWSTONE);

      // 6. Procedural Distant Sky Pebbles / Mini Treasure Islets beyond radius 32
      if (Math.abs(cx) >= 2 || Math.abs(cz) >= 2) {
        const islandRoll = hash2D(cx, cz, this.noise.seed + 991);
        if (islandRoll > 0.72) {
          const icx = startX + 8;
          const icz = startZ + 8;
          const iy = 28 + Math.floor(hash2D(cx * 3, cz * 5, this.noise.seed + 997) * 12);
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) + Math.abs(dz) > 2) continue;
              setWorldBlock(icx + dx, iy, icz + dz, islandRoll > 0.9 ? BlockId.CAVE_MOSS : BlockId.GRASS);
              setWorldBlock(icx + dx, iy - 1, icz + dz, BlockId.STONE);
            }
          }
          setWorldBlock(
            icx,
            iy - 2,
            icz,
            islandRoll > 0.93 ? BlockId.DIAMOND_ORE : islandRoll > 0.85 ? BlockId.IRON_ORE : BlockId.COAL_ORE
          );
          if (islandRoll > 0.88) {
            setWorldBlock(icx, iy + 1, icz, BlockId.CRYSTAL_CLUSTER);
          }
        }
      }

      // Re-apply any player-modified blocks within this chunk
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const skyChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, skyChunk);
      return skyChunk;
    }

    if (this.worldType === 'tutorial') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 0 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      // 1. Base terraced tutorial valley surrounded by scenic perimeter hills
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          const distEdge = Math.max(Math.abs(wx), Math.abs(wz));
          const hillBlend = distEdge <= 20 ? 0 : Math.min(1, (distEdge - 20) / 18);
          const n = this.noise.fbm2D(wx * 0.035, wz * 0.035, 3, 0.5, 2.0, 409);
          const groundY = Math.round(25 + hillBlend * (5 + n * 7));

          for (let y = 0; y < CHUNK_H; y++) {
            const idx = this.blockIndex(lx, y, lz);
            if (y === 0) blocks[idx] = BlockId.BEDROCK;
            else if (y === groundY) blocks[idx] = BlockId.GRASS;
            else if (y >= groundY - 3 && y < groundY) blocks[idx] = BlockId.DIRT;
            else if (y < groundY - 3) blocks[idx] = BlockId.STONE;
            else blocks[idx] = BlockId.AIR;
          }
        }
      }

      // 2. Cobblestone walkways connecting all tutorial zones (y = 25)
      for (let wx = -14; wx <= 14; wx++) {
        for (let wz = -1; wz <= 1; wz++) {
          setWorldBlock(wx, 25, wz, BlockId.COBBLESTONE);
        }
      }
      for (let wz = -6; wz <= 13; wz++) {
        for (let wx = -1; wx <= 1; wx++) {
          setWorldBlock(wx, 25, wz, BlockId.COBBLESTONE);
        }
      }
      // Corner lamp posts along the main path
      for (const [lx, lz] of [
        [-5, -2],
        [5, -2],
        [-5, 2],
        [5, 2],
      ]) {
        setWorldBlock(lx, 26, lz, BlockId.OAK_LOG);
        setWorldBlock(lx, 27, lz, BlockId.TORCH);
      }

      // 3. Zone 1: Welcome Cabin (x: -4..4, z: -10..-4, floor y=25)
      for (let wx = -4; wx <= 4; wx++) {
        for (let wz = -10; wz <= -4; wz++) {
          setWorldBlock(wx, 25, wz, BlockId.OAK_PLANKS);
          const isWall = wx === -4 || wx === 4 || wz === -10 || wz === -4;
          const isCorner = (wx === -4 || wx === 4) && (wz === -10 || wz === -4);
          const isDoor = wz === -4 && Math.abs(wx) <= 1;
          for (let wy = 26; wy <= 29; wy++) {
            if (isWall) {
              if (isDoor && wy <= 27) {
                setWorldBlock(wx, wy, wz, BlockId.AIR);
              } else if (isCorner) {
                setWorldBlock(wx, wy, wz, BlockId.OAK_LOG);
              } else if (wy === 27 && !isDoor && (Math.abs(wx) === 2 || Math.abs(wz + 7) === 1)) {
                setWorldBlock(wx, wy, wz, BlockId.GLASS);
              } else {
                setWorldBlock(wx, wy, wz, BlockId.OAK_PLANKS);
              }
            } else {
              setWorldBlock(wx, wy, wz, BlockId.AIR);
            }
          }
          // Gabled roof slab at y=30
          setWorldBlock(wx, 30, wz, BlockId.BRICK);
        }
      }
      // Cozy Cabin Interior Stations & Lighting
      setWorldBlock(-3, 26, -9, BlockId.CRAFTING_TABLE);
      setWorldBlock(-2, 26, -9, BlockId.FURNACE);
      setWorldBlock(3, 26, -9, BlockId.CHEST);
      setWorldBlock(2, 26, -9, BlockId.BOOKSHELF);
      setWorldBlock(2, 27, -9, BlockId.BOOKSHELF);
      setWorldBlock(-3, 28, -5, BlockId.TORCH);
      setWorldBlock(3, 28, -5, BlockId.TORCH);

      // 4. Zone 2: Mining & Ore Quarry (East: x = 8..16, z = -4..4)
      for (let wx = 8; wx <= 16; wx++) {
        for (let wz = -4; wz <= 4; wz++) {
          const stepH = Math.min(4, Math.floor((wx - 8) / 2));
          for (let dy = 1; dy <= stepH + 1; dy++) {
            const wy = 25 + dy;
            let mat = BlockId.STONE;
            if (wx >= 14 && dy >= 3) mat = BlockId.DEEPSLATE;
            setWorldBlock(wx, wy, wz, mat);
          }
        }
      }
      // Showcase Ore Veins embedded visibly on the quarry face
      setWorldBlock(10, 27, -2, BlockId.COAL_ORE);
      setWorldBlock(10, 27, -1, BlockId.COAL_ORE);
      setWorldBlock(12, 28, 0, BlockId.IRON_ORE);
      setWorldBlock(12, 28, 1, BlockId.IRON_ORE);
      setWorldBlock(14, 29, -2, BlockId.GOLD_ORE);
      setWorldBlock(14, 29, 2, BlockId.DIAMOND_ORE);
      setWorldBlock(15, 30, 0, BlockId.EMERALD_ORE);
      setWorldBlock(9, 26, -3, BlockId.TORCH);
      setWorldBlock(9, 26, 3, BlockId.TORCH);

      // 5. Zone 3: Crafting & Building Practice Yard (West: x = -15..-7, z = -4..4)
      for (let wx = -15; wx <= -7; wx++) {
        for (let wz = -4; wz <= 4; wz++) {
          setWorldBlock(wx, 25, wz, BlockId.SANDSTONE);
        }
      }
      setWorldBlock(-9, 26, -3, BlockId.CRAFTING_TABLE);
      setWorldBlock(-10, 26, -3, BlockId.FURNACE);
      setWorldBlock(-11, 26, -3, BlockId.CHEST);
      // Half-built sample house frame for building practice
      for (let wx = -14; wx <= -10; wx++) {
        setWorldBlock(wx, 26, 3, BlockId.BRICK);
        setWorldBlock(wx, 27, 3, wx === -12 ? BlockId.GLASS : BlockId.WOOL);
      }
      setWorldBlock(-14, 28, 3, BlockId.GLOWSTONE);
      setWorldBlock(-10, 28, 3, BlockId.GLOWSTONE);

      // 6. Zone 4: Farm Pasture & Water Trough (South: x = -5..5, z = 8..16)
      for (let wx = -5; wx <= 5; wx++) {
        for (let wz = 8; wz <= 16; wz++) {
          const border = wx === -5 || wx === 5 || wz === 8 || wz === 16;
          if (border && !(wz === 8 && Math.abs(wx) <= 1)) {
            setWorldBlock(wx, 26, wz, (wx + wz) % 2 === 0 ? BlockId.OAK_LOG : BlockId.OAK_PLANKS);
          }
        }
      }
      // Water trough inside pen
      for (let wx = -3; wx <= -1; wx++) {
        setWorldBlock(wx, 25, 14, BlockId.WATER);
      }
      setWorldBlock(4, 27, 9, BlockId.TORCH);
      setWorldBlock(-4, 27, 9, BlockId.TORCH);

      // 7. Zone 5: Crystal Grotto Cavern Entrance (SE: x = 9..18, z = 7..16)
      for (let wx = 9; wx <= 18; wx++) {
        for (let wz = 7; wz <= 16; wz++) {
          // Mound hill above the grotto
          const roofH = wx >= 11 ? 30 : 28;
          for (let wy = 20; wy <= roofH; wy++) {
            const inCaveRoom = wx >= 10 && wx <= 17 && wz >= 8 && wz <= 15 && wy >= 21 && wy <= 26;
            const inArchDoor = wx >= 9 && wx <= 10 && wz >= 10 && wz <= 13 && wy >= 26 && wy <= 27;
            if (inCaveRoom || inArchDoor) {
              setWorldBlock(wx, wy, wz, BlockId.AIR);
            } else {
              setWorldBlock(wx, wy, wz, wy === roofH ? BlockId.GRASS : wy >= 26 ? BlockId.STONE : BlockId.DEEPSLATE);
            }
          }
          // Floor & ceiling accents inside grotto
          if (wx >= 10 && wx <= 17 && wz >= 8 && wz <= 15) {
            setWorldBlock(wx, 20, wz, BlockId.CAVE_MOSS);
            setWorldBlock(wx, 27, wz, BlockId.DRIPSTONE);
          }
        }
      }
      // Ramp stairs down into grotto + crystals & glow vines
      for (let step = 0; step < 5; step++) {
        setWorldBlock(9 + step, 25 - step, 11, BlockId.COBBLESTONE);
        setWorldBlock(9 + step, 25 - step, 12, BlockId.COBBLESTONE);
        setWorldBlock(9 + step, 26 - step, 11, BlockId.AIR);
        setWorldBlock(9 + step, 26 - step, 12, BlockId.AIR);
      }
      setWorldBlock(15, 21, 10, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(16, 21, 13, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(16, 22, 13, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(14, 26, 11, BlockId.GLOW_VINE);
      setWorldBlock(14, 25, 11, BlockId.GLOW_VINE);
      setWorldBlock(16, 26, 12, BlockId.GLOW_VINE);
      setWorldBlock(13, 26, 9, BlockId.DRIPSTONE);

      // 8. Zone 6: TNT Blast Range (SW: x = -15..-9, z = 7..13)
      for (let wx = -15; wx <= -9; wx++) {
        for (let wz = 7; wz <= 13; wz++) {
          const wall = wx === -15 || wx === -9 || wz === 7 || wz === 13;
          if (wall && !(wx === -9 && Math.abs(wz - 10) <= 1)) {
            setWorldBlock(wx, 26, wz, BlockId.OBSIDIAN);
            setWorldBlock(wx, 27, wz, BlockId.STONE);
          }
        }
      }
      setWorldBlock(-12, 26, 10, BlockId.TNT);
      setWorldBlock(-13, 26, 10, BlockId.SAND);
      setWorldBlock(-11, 26, 10, BlockId.GRAVEL);

      // 9. Decorative perimeter oak trees outside the central courtyard
      for (const [tx, tz] of [
        [-18, -16],
        [18, -16],
        [-20, 18],
        [21, 19],
        [0, -21],
      ]) {
        const lx = tx - startX;
        const lz = tz - startZ;
        if (lx >= -2 && lx < CHUNK_W + 2 && lz >= -2 && lz < CHUNK_D + 2) {
          for (let dy = 0; dy < 5; dy++) {
            setWorldBlock(tx, 26 + dy, tz, BlockId.OAK_LOG);
          }
          for (let dy = -2; dy <= 1; dy++) {
            const rad = dy === 1 ? 1 : 2;
            for (let ox = -rad; ox <= rad; ox++) {
              for (let oz = -rad; oz <= rad; oz++) {
                if (ox === 0 && oz === 0 && dy < 0) continue;
                setWorldBlock(tx + ox, 31 + dy, tz + oz, BlockId.LEAVES);
              }
            }
          }
        }
      }

      // Re-apply player modifications
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const tutChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, tutChunk);
      return tutChunk;
    }

    if (this.worldType === 'parkour') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      const fillBox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: BlockId) => {
        if (x1 < startX || x0 >= startX + CHUNK_W || z1 < startZ || z0 >= startZ + CHUNK_D) return;
        for (let wx = x0; wx <= x1; wx++) {
          for (let wz = z0; wz <= z1; wz++) {
            for (let wy = y0; wy <= y1; wy++) {
              setWorldBlock(wx, wy, wz, id);
            }
          }
        }
      };

      // 0. Start Plaza (x: -2..2, z: -2..2, wy: 31 -> stand at y = 32)
      fillBox(-2, 30, -2, 2, 30, 2, BlockId.COBBLESTONE);
      fillBox(-2, 31, -2, 2, 31, 2, BlockId.OAK_PLANKS);
      fillBox(-1, 31, -1, 1, 31, 1, BlockId.MOSSY_COBBLESTONE);
      setWorldBlock(0, 31, 0, BlockId.EMERALD_BLOCK);
      for (const [px, pz] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        setWorldBlock(px, 32, pz, BlockId.OAK_LOG);
        setWorldBlock(px, 33, pz, BlockId.TORCH);
      }
      setWorldBlock(2, 32, 1, BlockId.CHEST);

      // 1. Stage 1: Meadow Steps (z: -5 down to -27, y: 31 -> 34)
      fillBox(-1, 31, -6, 0, 31, -5, BlockId.OAK_PLANKS);
      fillBox(1, 31, -10, 2, 31, -9, BlockId.DIRT);
      fillBox(1, 32, -10, 2, 32, -9, BlockId.GRASS);
      fillBox(-2, 32, -14, -1, 32, -13, BlockId.OAK_PLANKS);
      fillBox(0, 32, -18, 1, 32, -17, BlockId.DIRT);
      fillBox(0, 33, -18, 1, 33, -17, BlockId.GRASS);
      fillBox(0, 33, -23, 0, 33, -21, BlockId.OAK_PLANKS);
      fillBox(-1, 34, -27, 1, 34, -26, BlockId.MOSSY_COBBLESTONE);

      // Checkpoint 1 Platform (x: -2..2, z: -34..-30, wy: 34 -> stand at y = 35)
      fillBox(-2, 33, -34, 2, 33, -30, BlockId.STONE);
      fillBox(-2, 34, -34, 2, 34, -30, BlockId.COBBLESTONE);
      setWorldBlock(0, 34, -32, BlockId.GOLD_BLOCK);
      setWorldBlock(-2, 35, -34, BlockId.OAK_LOG);
      setWorldBlock(-2, 36, -34, BlockId.TORCH);
      setWorldBlock(2, 35, -34, BlockId.OAK_LOG);
      setWorldBlock(2, 36, -34, BlockId.TORCH);

      // 2. Stage 2: Crimson Brick Leap (z: -37 down to -63, y: 34 -> 39)
      fillBox(0, 33, -37, 0, 34, -37, BlockId.BRICK);
      fillBox(2, 35, -41, 3, 35, -40, BlockId.BRICK);
      // 3-block sprint jump gap (-42, -43, -44)
      fillBox(2, 35, -46, 3, 35, -45, BlockId.BRICK);
      fillBox(-1, 36, -50, 0, 36, -49, BlockId.GLASS);
      fillBox(-4, 36, -54, -3, 36, -53, BlockId.WOOL);
      fillBox(-3, 37, -58, -3, 37, -57, BlockId.BRICK);
      fillBox(-1, 37, -61, -1, 38, -61, BlockId.BRICK);
      fillBox(1, 38, -63, 1, 39, -63, BlockId.BRICK);

      // Checkpoint 2 Platform (x: -2..2, z: -70..-66, wy: 39 -> stand at y = 40)
      fillBox(-2, 38, -70, 2, 38, -66, BlockId.STONE);
      fillBox(-2, 39, -70, 2, 39, -66, BlockId.BRICK);
      setWorldBlock(0, 39, -68, BlockId.GOLD_BLOCK);
      setWorldBlock(-2, 40, -70, BlockId.BRICK);
      setWorldBlock(-2, 41, -70, BlockId.GLOWSTONE);
      setWorldBlock(2, 40, -70, BlockId.BRICK);
      setWorldBlock(2, 41, -70, BlockId.GLOWSTONE);

      // 3. Stage 3: Crystal Cave Spire (z: -73 down to -94, y: 39 -> 46)
      fillBox(-1, 38, -74, 0, 38, -73, BlockId.DEEPSLATE);
      fillBox(-1, 39, -74, 0, 39, -73, BlockId.CAVE_MOSS);
      fillBox(2, 39, -78, 3, 39, -77, BlockId.DEEPSLATE);
      fillBox(2, 40, -78, 3, 40, -77, BlockId.CAVE_MOSS);
      fillBox(4, 41, -82, 5, 41, -81, BlockId.DEEPSLATE);
      fillBox(2, 41, -86, 3, 41, -85, BlockId.DEEPSLATE);
      fillBox(2, 42, -86, 3, 42, -85, BlockId.CAVE_MOSS);
      fillBox(0, 41, -89, 0, 42, -88, BlockId.DRIPSTONE);
      fillBox(0, 43, -89, 0, 43, -88, BlockId.DEEPSLATE);
      fillBox(-3, 43, -86, -2, 43, -85, BlockId.DEEPSLATE);
      fillBox(-3, 44, -86, -2, 44, -85, BlockId.CAVE_MOSS);
      fillBox(-5, 45, -90, -4, 45, -89, BlockId.DEEPSLATE);
      fillBox(-3, 45, -94, -2, 45, -93, BlockId.DEEPSLATE);
      fillBox(-3, 46, -94, -2, 46, -93, BlockId.CAVE_MOSS);

      // Checkpoint 3 Platform (x: -2..2, z: -101..-97, wy: 46 -> stand at y = 47)
      fillBox(-2, 45, -101, 2, 45, -97, BlockId.DEEPSLATE);
      fillBox(-2, 46, -101, 2, 46, -97, BlockId.CAVE_MOSS);
      setWorldBlock(0, 46, -99, BlockId.GOLD_BLOCK);
      setWorldBlock(-2, 47, -101, BlockId.GLOWSTONE);
      setWorldBlock(-2, 48, -101, BlockId.CRYSTAL_CLUSTER);
      setWorldBlock(2, 47, -101, BlockId.GLOWSTONE);
      setWorldBlock(2, 48, -101, BlockId.CRYSTAL_CLUSTER);

      // 4. Stage 4: Obsidian Sky Sprint -> Diamond Summit (z: -104 down to -133, y: 46 -> 51)
      fillBox(-1, 46, -105, 0, 46, -104, BlockId.OBSIDIAN);
      // 3-block sprint gap (-106, -107, -108) + 1 block rise
      fillBox(-1, 47, -110, 0, 47, -109, BlockId.OBSIDIAN);
      fillBox(2, 48, -114, 3, 48, -113, BlockId.IRON_BLOCK);
      fillBox(-2, 49, -118, -1, 49, -117, BlockId.OBSIDIAN);
      fillBox(-1, 50, -122, 1, 50, -121, BlockId.GOLD_BLOCK);

      // Victory / Finish Temple (x: -4..4, z: -133..-125, wy: 51 -> stand at y = 52)
      fillBox(-4, 50, -133, 4, 50, -125, BlockId.DEEPSLATE);
      fillBox(-4, 51, -133, 4, 51, -125, BlockId.IRON_BLOCK);
      fillBox(-2, 51, -131, 2, 51, -127, BlockId.EMERALD_BLOCK);
      fillBox(-1, 51, -130, 1, 51, -128, BlockId.DIAMOND_BLOCK);
      setWorldBlock(0, 51, -129, BlockId.GOLD_BLOCK);
      for (const [px, pz] of [
        [-4, -133],
        [4, -133],
        [-4, -125],
        [4, -125],
      ]) {
        fillBox(px, 52, pz, px, 54, pz, BlockId.DIAMOND_BLOCK);
        setWorldBlock(px, 55, pz, BlockId.GLOWSTONE);
      }
      setWorldBlock(0, 52, -132, BlockId.CHEST);
      setWorldBlock(-1, 52, -132, BlockId.TORCH);
      setWorldBlock(1, 52, -132, BlockId.TORCH);

      // 5. Scenic Distant Floating Clouds (well clear of course corridor)
      if (Math.abs(cx) >= 1) {
        const cloudRoll = hash2D(cx, cz, this.noise.seed + 773);
        if (cloudRoll > 0.62) {
          const icx = startX + 8;
          const icz = startZ + 8;
          const cy = 44 + Math.floor(hash2D(cx * 2, cz * 3, this.noise.seed + 787) * 14);
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;
              setWorldBlock(icx + dx, cy, icz + dz, BlockId.WOOL);
            }
          }
        }
      }

      // Re-apply player modifications
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const parkourChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, parkourChunk);
      return parkourChunk;
    }

    if (this.worldType === 'parkour100') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      const fillBox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: BlockId) => {
        if (x1 < startX || x0 >= startX + CHUNK_W || z1 < startZ || z0 >= startZ + CHUNK_D) return;
        for (let wx = x0; wx <= x1; wx++) {
          for (let wz = z0; wz <= z1; wz++) {
            for (let wy = y0; wy <= y1; wy++) {
              setWorldBlock(wx, wy, wz, id);
            }
          }
        }
      };

      for (const lvl of PARKOUR_100_LEVELS) {
        if (lvl.x1 < startX - 1 || lvl.x0 > startX + CHUNK_W || lvl.z1 < startZ - 1 || lvl.z0 > startZ + CHUNK_D) {
          continue;
        }

        if (lvl.level === 0) {
          fillBox(lvl.x0, lvl.y - 1, lvl.z0, lvl.x1, lvl.y - 1, lvl.z1, BlockId.COBBLESTONE);
          fillBox(lvl.x0, lvl.y, lvl.z0, lvl.x1, lvl.y, lvl.z1, BlockId.OAK_PLANKS);
          setWorldBlock(0, lvl.y, 0, BlockId.EMERALD_BLOCK);
          for (const [px, pz] of [
            [lvl.x0, lvl.z0],
            [lvl.x1, lvl.z0],
            [lvl.x0, lvl.z1],
            [lvl.x1, lvl.z1],
          ]) {
            setWorldBlock(px, lvl.y + 1, pz, BlockId.OAK_LOG);
            setWorldBlock(px, lvl.y + 2, pz, BlockId.TORCH);
          }
          setWorldBlock(2, lvl.y + 1, 1, BlockId.CHEST);
        } else if (lvl.level === 100) {
          fillBox(lvl.x0, lvl.y - 1, lvl.z0, lvl.x1, lvl.y - 1, lvl.z1, BlockId.DEEPSLATE);
          fillBox(lvl.x0, lvl.y, lvl.z0, lvl.x1, lvl.y, lvl.z1, BlockId.IRON_BLOCK);
          fillBox(lvl.x0 + 1, lvl.y, lvl.z0 + 1, lvl.x1 - 1, lvl.y, lvl.z1 - 1, BlockId.EMERALD_BLOCK);
          fillBox(lvl.x0 + 2, lvl.y, lvl.z0 + 2, lvl.x1 - 2, lvl.y, lvl.z1 - 2, BlockId.DIAMOND_BLOCK);
          const midX = Math.floor((lvl.x0 + lvl.x1) / 2);
          const midZ = Math.floor((lvl.z0 + lvl.z1) / 2);
          setWorldBlock(midX, lvl.y, midZ, BlockId.GOLD_BLOCK);
          for (const [px, pz] of [
            [lvl.x0, lvl.z0],
            [lvl.x1, lvl.z0],
            [lvl.x0, lvl.z1],
            [lvl.x1, lvl.z1],
          ]) {
            fillBox(px, lvl.y + 1, pz, px, lvl.y + 3, pz, BlockId.DIAMOND_BLOCK);
            setWorldBlock(px, lvl.y + 4, pz, BlockId.GLOWSTONE);
          }
          setWorldBlock(midX, lvl.y + 1, lvl.z0 + 1, BlockId.CHEST);
          setWorldBlock(midX - 1, lvl.y + 1, lvl.z0 + 1, BlockId.TORCH);
          setWorldBlock(midX + 1, lvl.y + 1, lvl.z0 + 1, BlockId.TORCH);
        } else if (lvl.isMilestone) {
          fillBox(lvl.x0, lvl.y - 1, lvl.z0, lvl.x1, lvl.y - 1, lvl.z1, lvl.subBlockId ?? BlockId.STONE);
          fillBox(lvl.x0, lvl.y, lvl.z0, lvl.x1, lvl.y, lvl.z1, lvl.blockId);
          const midX = Math.floor((lvl.x0 + lvl.x1) / 2);
          const midZ = Math.floor((lvl.z0 + lvl.z1) / 2);
          setWorldBlock(midX, lvl.y, midZ, BlockId.GOLD_BLOCK);
          setWorldBlock(lvl.x0, lvl.y + 1, lvl.z0, lvl.accentId ?? BlockId.GLOWSTONE);
          setWorldBlock(lvl.x1, lvl.y + 1, lvl.z0, lvl.accentId ?? BlockId.GLOWSTONE);
          setWorldBlock(lvl.x0, lvl.y + 2, lvl.z0, BlockId.TORCH);
          setWorldBlock(lvl.x1, lvl.y + 2, lvl.z0, BlockId.TORCH);
        } else {
          fillBox(lvl.x0, lvl.y, lvl.z0, lvl.x1, lvl.y, lvl.z1, lvl.blockId);
        }
      }

      // Scenic distant clouds well outside the [-12..+12] jump corridor
      if (Math.abs(cx) >= 2) {
        const cloudRoll = hash2D(cx, cz, this.noise.seed + 881);
        if (cloudRoll > 0.65) {
          const icx = startX + 8;
          const icz = startZ + 8;
          const cy = 44 + Math.floor(hash2D(cx * 2, cz * 3, this.noise.seed + 887) * 14);
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;
              setWorldBlock(icx + dx, cy, icz + dz, BlockId.WOOL);
            }
          }
        }
      }

      // Re-apply player modifications
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const parkour100Chunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, parkour100Chunk);
      return parkour100Chunk;
    }

    if (this.worldType === 'wouldyourather') {
      const setWorldBlock = (wx: number, wy: number, wz: number, id: BlockId) => {
        if (wy < 1 || wy >= CHUNK_H) return;
        const lx = wx - startX;
        const lz = wz - startZ;
        if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
          blocks[this.blockIndex(lx, wy, lz)] = id;
        }
      };

      const fillBox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: BlockId) => {
        if (x1 < startX || x0 >= startX + CHUNK_W || z1 < startZ || z0 >= startZ + CHUNK_D) return;
        for (let wx = x0; wx <= x1; wx++) {
          for (let wz = z0; wz <= z1; wz++) {
            for (let wy = y0; wy <= y1; wy++) {
              setWorldBlock(wx, wy, wz, id);
            }
          }
        }
      };

      for (const lvl of WOULD_YOU_RATHER_LEVELS) {
        if (lvl.exitZ0 > startZ + CHUNK_D || lvl.entryZ1 < startZ - 1 || startX > 6 || startX + CHUNK_W - 1 < -6) {
          continue;
        }

        if (lvl.level === 0) {
          fillBox(-3, lvl.y - 1, -2, 3, lvl.y - 1, 2, BlockId.COBBLESTONE);
          fillBox(-3, lvl.y, -2, 3, lvl.y, 2, BlockId.OAK_PLANKS);
          fillBox(-2, lvl.y, -2, -2, lvl.y, 0, BlockId.EMERALD_BLOCK);
          fillBox(2, lvl.y, -2, 2, lvl.y, 0, BlockId.GOLD_BLOCK);
          setWorldBlock(0, lvl.y, 0, BlockId.DIAMOND_BLOCK);
          for (const [px, pz] of [
            [-3, -2],
            [3, -2],
            [-3, 2],
            [3, 2],
          ]) {
            setWorldBlock(px, lvl.y + 1, pz, BlockId.OAK_LOG);
            setWorldBlock(px, lvl.y + 2, pz, BlockId.TORCH);
          }
          setWorldBlock(2, lvl.y + 1, 1, BlockId.CHEST);
          continue;
        }

        const y = lvl.y;
        // Entry bridge (entryZ1 down to entryZ0; widest on entryZ0 to connect orthogonally to A and B lanes)
        fillBox(-1, y, lvl.entryZ1, 1, y, lvl.entryZ1, lvl.trimMat);
        fillBox(-3, y, lvl.entryZ0, 3, y, lvl.entryZ0, lvl.trimMat);
        setWorldBlock(0, y, lvl.entryZ1, BlockId.STONE);
        setWorldBlock(0, y, lvl.entryZ0, BlockId.GOLD_BLOCK);

        // Left Choice A Lane (x: -5..-2) with Emerald/Accent Gate Arch
        fillBox(-5, y, lvl.forkZ0, -2, y, lvl.forkZ1, lvl.trimMat);
        fillBox(-4, y, lvl.forkZ0, -3, y, lvl.forkZ1, lvl.matA);
        // Arch A at forkZ1
        fillBox(-5, y + 1, lvl.forkZ1, -5, y + 3, lvl.forkZ1, lvl.matA);
        fillBox(-2, y + 1, lvl.forkZ1, -2, y + 3, lvl.forkZ1, lvl.matA);
        fillBox(-5, y + 3, lvl.forkZ1, -2, y + 3, lvl.forkZ1, lvl.matA);
        setWorldBlock(-3, y + 4, lvl.forkZ1, BlockId.GLOWSTONE);

        // Right Choice B Lane (x: 2..5) with Gold/Crimson Gate Arch
        fillBox(2, y, lvl.forkZ0, 5, y, lvl.forkZ1, lvl.trimMat);
        fillBox(3, y, lvl.forkZ0, 4, y, lvl.forkZ1, lvl.matB);
        // Arch B at forkZ1
        fillBox(2, y + 1, lvl.forkZ1, 2, y + 3, lvl.forkZ1, lvl.matB);
        fillBox(5, y + 1, lvl.forkZ1, 5, y + 3, lvl.forkZ1, lvl.matB);
        fillBox(2, y + 3, lvl.forkZ1, 5, y + 3, lvl.forkZ1, lvl.matB);
        setWorldBlock(3, y + 4, lvl.forkZ1, BlockId.GLOWSTONE);

        // Exit Rejoin Bridge (exitZ1 wide to join both lanes -> exitZ0 narrow into next stage)
        fillBox(-3, y, lvl.exitZ1, 3, y, lvl.exitZ1, lvl.trimMat);
        fillBox(-1, y, lvl.exitZ0, 1, y, lvl.exitZ0, lvl.trimMat);
        if (lvl.isMilestone) {
          setWorldBlock(0, y, lvl.exitZ1, BlockId.EMERALD_BLOCK);
          setWorldBlock(-3, y + 1, lvl.exitZ1, BlockId.TORCH);
          setWorldBlock(3, y + 1, lvl.exitZ1, BlockId.TORCH);
          setWorldBlock(-2, y + 1, lvl.exitZ1, BlockId.CHEST);
        }
      }

      // Champion Summit at the end of Level 100
      if (WYR_FINISH_Z0 <= startZ + CHUNK_D && WYR_FINISH_Z1 >= startZ - 1 && startX <= 5 && startX + CHUNK_W - 1 >= -5) {
        const fy = WYR_FINISH_Y;
        fillBox(-4, fy - 1, WYR_FINISH_Z0, 4, fy - 1, WYR_FINISH_Z1, BlockId.DEEPSLATE);
        fillBox(-4, fy, WYR_FINISH_Z0, 4, fy, WYR_FINISH_Z1, BlockId.GOLD_BLOCK);
        fillBox(-3, fy, WYR_FINISH_Z0 + 1, 3, fy, WYR_FINISH_Z1 - 1, BlockId.EMERALD_BLOCK);
        fillBox(-1, fy, WYR_FINISH_Z0 + 2, 1, fy, WYR_FINISH_Z1 - 2, BlockId.DIAMOND_BLOCK);
        for (const [px, pz] of [
          [-4, WYR_FINISH_Z0],
          [4, WYR_FINISH_Z0],
          [-4, WYR_FINISH_Z1],
          [4, WYR_FINISH_Z1],
        ]) {
          fillBox(px, fy + 1, pz, px, fy + 3, pz, BlockId.DIAMOND_BLOCK);
          setWorldBlock(px, fy + 4, pz, BlockId.GLOWSTONE);
        }
        setWorldBlock(0, fy + 1, WYR_FINISH_Z0 + 1, BlockId.CHEST);
        setWorldBlock(-1, fy + 1, WYR_FINISH_Z0 + 1, BlockId.TORCH);
        setWorldBlock(1, fy + 1, WYR_FINISH_Z0 + 1, BlockId.TORCH);
      }

      // Distant floating clouds outside the hall corridor
      if (Math.abs(cx) >= 2) {
        const cloudRoll = hash2D(cx, cz, this.noise.seed + 853);
        if (cloudRoll > 0.65) {
          const icx = startX + 8;
          const icz = startZ + 8;
          const cy = 44 + Math.floor(hash2D(cx * 2, cz * 3, this.noise.seed + 859) * 14);
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;
              setWorldBlock(icx + dx, cy, icz + dz, BlockId.WOOL);
            }
          }
        }
      }

      for (let lx = 0; lx < CHUNK_W; lx++) {
        const wx = startX + lx;
        for (let lz = 0; lz < CHUNK_D; lz++) {
          const wz = startZ + lz;
          for (let y = 0; y < CHUNK_H; y++) {
            const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
            if (mod !== undefined) {
              blocks[this.blockIndex(lx, y, lz)] = mod;
            }
          }
        }
      }

      const wyrChunk: ChunkData = {
        cx,
        cz,
        blocks,
        opaqueMesh: null,
        cutoutMesh: null,
        waterMesh: null,
        dirty: true,
      };
      this.chunks.set(key, wyrChunk);
      return wyrChunk;
    }

    // 1. Base terrain column + multi-layer 3D noise caves (mega caverns + winding tunnels + surface openings)
    for (let lx = 0; lx < CHUNK_W; lx++) {
      const wx = startX + lx;
      for (let lz = 0; lz < CHUNK_D; lz++) {
        const wz = startZ + lz;
        const { biome, height } = this.getBiomeAt(wx, wz);
        const caveBiome = this.getCaveBiomeAt(wx, wz);

        // Dry-land gate for natural walkable surface cave openings (keeps oceans sealed above)
        const canBreakSurface = biome !== 'Ocean' && height > SEA_LEVEL + 2;
        const surfaceMouth = canBreakSurface
          ? this.noise.fbm2D(wx * 0.022, wz * 0.022, 2, 0.5, 2.0, 613)
          : -1;
        const mouthFactor = surfaceMouth > 0.24 ? Math.min(1, (surfaceMouth - 0.24) / 0.32) : 0;

        for (let y = 0; y < CHUNK_H; y++) {
          const idx = this.blockIndex(lx, y, lz);

          if (y === 0) {
            blocks[idx] = BlockId.BEDROCK;
            continue;
          }

          if (y <= height) {
            let isCave = false;

            // Keep deep underwater ocean beds sealed so seas don't drain abruptly
            const safeMaxCaveY = canBreakSurface
              ? mouthFactor > 0.15
                ? height
                : height - 2
              : Math.min(height - 4, SEA_LEVEL - 4);

            if (y >= 3 && y <= safeMaxCaveY) {
              // Domain warp makes tunnels meander organically across chunk seams
              const warpX = this.noise.noise3D(wx * 0.024, y * 0.03, wz * 0.024, 173) * 3.8;
              const warpZ = this.noise.noise3D(wx * 0.024, y * 0.03, wz * 0.024, 191) * 3.8;
              const qx = wx + warpX;
              const qz = wz + warpZ;

              // A) Vast cavernous chambers (Cheese noise) deep underground (y = 3..25)
              if (y <= 25) {
                const cavernMacro = this.noise.fbm3D(qx * 0.028, y * 0.048, qz * 0.028, 3, 0.55, 2.0, 251);
                // Smooth ceiling arch & flatter floor envelope around y = 5..21
                const archEnv =
                  y < 5 ? (5 - y) * 0.16 : y > 19 ? (y - 19) * 0.095 : 0;
                const cavernThreshold = caveBiome === 'Deep Hollows' ? 0.24 : 0.19;
                if (cavernMacro - archEnv > cavernThreshold) {
                  isCave = true;
                }
              }

              // B) Winding interconnected spaghetti tunnels bridging surface mouths <-> deep caverns
              if (!isCave) {
                const t1 = this.noise.noise3D(qx * 0.044, y * 0.055, qz * 0.044, 201);
                const t2 = this.noise.noise3D(qx * 0.044, y * 0.055, qz * 0.044, 307);
                const tubeDistSq = t1 * t1 + t2 * t2;
                const baseTubeThresh = y < 22 ? 0.021 : 0.0145 + mouthFactor * 0.026;
                if (tubeDistSq < baseTubeThresh) {
                  isCave = true;
                }
              }

              // C) Secondary steep connector shafts bridging upper tunnels into vast lower chambers
              if (!isCave && y < height - 1) {
                const s1 = this.noise.noise3D(wx * 0.034 + y * 0.025, y * 0.032, wz * 0.034, 389);
                const s2 = this.noise.noise3D(wx * 0.034, y * 0.032, wz * 0.034 - y * 0.025, 401);
                if (s1 * s1 + s2 * s2 < 0.011 + mouthFactor * 0.01) {
                  isCave = true;
                }
              }
            }

            if (isCave) {
              if (y <= SEA_LEVEL && biome === 'Ocean') {
                blocks[idx] = BlockId.WATER;
              } else if (caveBiome === 'Lush Cavern' && y <= 4) {
                const poolN = this.noise.noise2D(wx * 0.09, wz * 0.09, 641);
                blocks[idx] = poolN > 0.12 ? BlockId.WATER : BlockId.AIR;
              } else {
                blocks[idx] = BlockId.AIR;
              }
              continue;
            }

            if (y === height) {
              if (y <= SEA_LEVEL + 1 && biome !== 'Alpine Peaks') {
                blocks[idx] = y < SEA_LEVEL - 2 ? BlockId.CLAY : BlockId.SAND;
              } else if (biome === 'Desert') {
                blocks[idx] = BlockId.SAND;
              } else if (biome === 'Alpine Peaks' && y >= 42) {
                blocks[idx] = BlockId.SNOW;
              } else if (biome === 'Alpine Peaks' && y >= 36) {
                blocks[idx] = BlockId.STONE;
              } else {
                blocks[idx] = BlockId.GRASS;
              }
            } else if (y >= height - 3) {
              if (biome === 'Desert') {
                blocks[idx] = y === height - 1 ? BlockId.SAND : BlockId.SANDSTONE;
              } else if (y <= SEA_LEVEL + 1 && biome === 'Ocean') {
                blocks[idx] = BlockId.SAND;
              } else if (biome === 'Alpine Peaks' && y >= 35) {
                blocks[idx] = BlockId.STONE;
              } else {
                blocks[idx] = BlockId.DIRT;
              }
            } else {
              // Deep strata + rich cave-exposed mineral veins
              const oreNoise = this.noise.noise3D(wx * 0.22, y * 0.22, wz * 0.22, 419);
              if (y <= 3 && oreNoise < -0.56) {
                blocks[idx] = BlockId.OBSIDIAN;
              } else if (biome === 'Alpine Peaks' && y <= 26 && oreNoise > 0.54 && hash2D(wx + y, wz * 2, 131) > 0.42) {
                blocks[idx] = BlockId.EMERALD_ORE;
              } else if (y <= 13 && oreNoise > 0.56) {
                blocks[idx] = BlockId.DIAMOND_ORE;
              } else if (y <= 21 && oreNoise < -0.52) {
                blocks[idx] = BlockId.GOLD_ORE;
              } else if (y <= 36 && Math.abs(oreNoise) > 0.47 && hash2D(wx + y, wz - y, 88) > 0.42) {
                blocks[idx] = BlockId.IRON_ORE;
              } else if (y <= 48 && oreNoise > 0.37 && hash2D(wx * 3, wz + y, 77) > 0.52) {
                blocks[idx] = BlockId.COAL_ORE;
              } else if (y <= 18 && oreNoise < -0.45) {
                blocks[idx] = BlockId.GRAVEL;
              } else if (y <= 14 || (caveBiome === 'Crystal Cavern' && y < height - 5)) {
                blocks[idx] = BlockId.DEEPSLATE;
              } else {
                blocks[idx] = BlockId.STONE;
              }
            }
          } else if (y <= SEA_LEVEL) {
            blocks[idx] = BlockId.WATER;
          } else {
            blocks[idx] = BlockId.AIR;
          }
        }

        // 1b. Cavernous Biome Lining & Stalactites/Stalagmites/Crystals/Glow Vines
        // Operates strictly within the (wx, wz) column so cross-chunk terrain remains 100% seamless
        const deepCap = Math.min(height - 3, 27);
        for (let y = 2; y <= deepCap; y++) {
          const idx = this.blockIndex(lx, y, lz);
          if (blocks[idx] !== BlockId.AIR) continue;

          const belowIdx = this.blockIndex(lx, y - 1, lz);
          const aboveIdx = this.blockIndex(lx, y + 1, lz);
          const below = blocks[belowIdx];
          const above = blocks[aboveIdx];
          const isFloor = below === BlockId.STONE || below === BlockId.DEEPSLATE || below === BlockId.GRAVEL;
          const isCeiling = above === BlockId.STONE || above === BlockId.DEEPSLATE;
          const hVal = hash2D(wx * 7 + y, wz * 11 - y, this.noise.seed + 733);

          if (caveBiome === 'Lush Cavern') {
            if (isFloor) {
              blocks[belowIdx] = BlockId.CAVE_MOSS;
              if (hVal > 0.94 && blocks[aboveIdx] === BlockId.AIR) {
                blocks[idx] = BlockId.GLOW_VINE;
              }
            }
            if (isCeiling) {
              blocks[aboveIdx] = BlockId.CAVE_MOSS;
              if (hVal > 0.8) {
                const len = 1 + Math.floor(hash2D(wx, wz + y, 743) * 3);
                for (let d = 0; d < len && y - d >= 3; d++) {
                  const vIdx = this.blockIndex(lx, y - d, lz);
                  if (blocks[vIdx] !== BlockId.AIR) break;
                  blocks[vIdx] = BlockId.GLOW_VINE;
                }
              }
            }
          } else if (caveBiome === 'Crystal Cavern') {
            if (isFloor && below === BlockId.STONE) blocks[belowIdx] = BlockId.DEEPSLATE;
            if (isCeiling && above === BlockId.STONE) blocks[aboveIdx] = BlockId.DEEPSLATE;
            if (isFloor && hVal > 0.915) {
              const spire = hVal > 0.975 ? 2 : 1;
              for (let d = 0; d < spire && y + d < deepCap; d++) {
                const cIdx = this.blockIndex(lx, y + d, lz);
                if (blocks[cIdx] === BlockId.AIR) blocks[cIdx] = BlockId.CRYSTAL_CLUSTER;
              }
            } else if (isCeiling && hVal > 0.925) {
              blocks[idx] = BlockId.CRYSTAL_CLUSTER;
            }
          } else if (caveBiome === 'Dripstone Caves') {
            if (isFloor) blocks[belowIdx] = BlockId.DRIPSTONE;
            if (isCeiling) blocks[aboveIdx] = BlockId.DRIPSTONE;
            if (isFloor && hVal > 0.92) {
              const spire = 1 + Math.floor(hash2D(wx + 3, wz, 751) * 2);
              for (let d = 0; d < spire && y + d < deepCap; d++) {
                const sIdx = this.blockIndex(lx, y + d, lz);
                if (blocks[sIdx] === BlockId.AIR) blocks[sIdx] = BlockId.DRIPSTONE;
              }
            } else if (isCeiling && hVal > 0.9) {
              const spire = 1 + Math.floor(hash2D(wx, wz + 5, 761) * 3);
              for (let d = 0; d < spire && y - d >= 3; d++) {
                const sIdx = this.blockIndex(lx, y - d, lz);
                if (blocks[sIdx] === BlockId.AIR) blocks[sIdx] = BlockId.DRIPSTONE;
              }
            }
          } else {
            // Deep Hollows: occasional mossy cobblestone patches & glowing veins
            if (isFloor && hVal > 0.87) {
              blocks[belowIdx] = BlockId.MOSSY_COBBLESTONE;
            }
          }
        }
      }
    }

    // 2. Deterministic cross-chunk trees & cacti (only spawn where surface ground wasn't carved by a cave mouth!)
    for (let tx = startX - 2; tx < startX + CHUNK_W + 2; tx++) {
      for (let tz = startZ - 2; tz < startZ + CHUNK_D + 2; tz++) {
        const tree = this.hasTreeAt(tx, tz);
        if (!tree.hasTree) continue;
        // Check deterministic surface mouth gate so trees never float over open cave mouths
        const mouthCheck = this.noise.fbm2D(tx * 0.022, tz * 0.022, 2, 0.5, 2.0, 613);
        if (mouthCheck > 0.24) continue;

        const baseY = tree.height + 1;
        if (tree.type === 'cactus') {
          const ch = 2 + Math.floor(hash2D(tx, tz, 911) * 3);
          const lx = tx - startX;
          const lz = tz - startZ;
          if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
            for (let dy = 0; dy < ch; dy++) {
              if (baseY + dy < CHUNK_H) {
                blocks[this.blockIndex(lx, baseY + dy, lz)] = BlockId.CACTUS;
              }
            }
          }
        } else {
          // Oak tree: trunk height 4..6, canopy radius 2
          const trunkH = 4 + Math.floor(hash2D(tx, tz, 701) * 3);
          for (let dy = 0; dy < trunkH; dy++) {
            const lx = tx - startX;
            const lz = tz - startZ;
            const y = baseY + dy;
            if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D && y < CHUNK_H) {
              blocks[this.blockIndex(lx, y, lz)] = BlockId.OAK_LOG;
            }
          }
          // Leaf canopy
          const topY = baseY + trunkH;
          for (let dy = -2; dy <= 1; dy++) {
            const rad = dy === 1 ? 1 : 2;
            const y = topY + dy;
            if (y < 1 || y >= CHUNK_H) continue;
            for (let ox = -rad; ox <= rad; ox++) {
              for (let oz = -rad; oz <= rad; oz++) {
                if (ox === 0 && oz === 0 && dy < 0) continue;
                if (Math.abs(ox) === rad && Math.abs(oz) === rad && hash2D(tx + ox, tz + oz + dy, 333) > 0.45) {
                  continue;
                }
                const lx = tx + ox - startX;
                const lz = tz + oz - startZ;
                if (lx >= 0 && lx < CHUNK_W && lz >= 0 && lz < CHUNK_D) {
                  const idx = this.blockIndex(lx, y, lz);
                  if (blocks[idx] === BlockId.AIR) {
                    blocks[idx] = BlockId.LEAVES;
                  }
                }
              }
            }
          }
        }
      }
    }

    // 3. Re-apply any player-modified blocks within this chunk
    for (let lx = 0; lx < CHUNK_W; lx++) {
      const wx = startX + lx;
      for (let lz = 0; lz < CHUNK_D; lz++) {
        const wz = startZ + lz;
        for (let y = 0; y < CHUNK_H; y++) {
          const mod = this.modifiedBlocks.get(`${wx},${y},${wz}`);
          if (mod !== undefined) {
            blocks[this.blockIndex(lx, y, lz)] = mod;
          }
        }
      }
    }

    const chunk: ChunkData = {
      cx,
      cz,
      blocks,
      opaqueMesh: null,
      cutoutMesh: null,
      waterMesh: null,
      dirty: true,
    };
    this.chunks.set(key, chunk);
    return chunk;
  }

  public getBlock(wx: number, wy: number, wz: number): BlockId {
    const y = Math.floor(wy);
    if (y < 0) return BlockId.BEDROCK;
    if (y >= CHUNK_H) return BlockId.AIR;
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_W);
    const cz = Math.floor(z / CHUNK_D);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) {
      const mod = this.modifiedBlocks.get(`${x},${y},${z}`);
      return mod !== undefined ? mod : BlockId.AIR;
    }
    const lx = x - cx * CHUNK_W;
    const lz = z - cz * CHUNK_D;
    return chunk.blocks[this.blockIndex(lx, y, lz)] as BlockId;
  }

  public setBlock(wx: number, wy: number, wz: number, id: BlockId): void {
    const y = Math.floor(wy);
    if (y <= 0 || y >= CHUNK_H) return;
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_W);
    const cz = Math.floor(z / CHUNK_D);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    this.modifiedBlocks.set(`${x},${y},${z}`, id);
    if (chunk) {
      const lx = x - cx * CHUNK_W;
      const lz = z - cz * CHUNK_D;
      chunk.blocks[this.blockIndex(lx, y, lz)] = id;
      chunk.dirty = true;
      // Mark neighboring chunks dirty if on boundary (for face culling + AO!)
      if (lx === 0) this.markDirty(cx - 1, cz);
      if (lx === CHUNK_W - 1) this.markDirty(cx + 1, cz);
      if (lz === 0) this.markDirty(cx, cz - 1);
      if (lz === CHUNK_D - 1) this.markDirty(cx, cz + 1);
    }
  }

  private markDirty(cx: number, cz: number) {
    const c = this.chunks.get(this.chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  private isSolidForAO(wx: number, wy: number, wz: number): number {
    const id = this.getBlock(wx, wy, wz);
    const def = BLOCK_DEFS[id];
    return def && def.solid && !def.transparent ? 1 : 0;
  }

  private vertexAO(
    wx: number,
    wy: number,
    wz: number,
    nx: number,
    ny: number,
    nz: number,
    cx: number,
    cy: number,
    cz: number
  ): number {
    // Corner offset relative to block center (0.5, 0.5, 0.5) -> sign in {-1, +1}
    const sx = cx > 0 ? 1 : -1;
    const sy = cy > 0 ? 1 : -1;
    const sz = cz > 0 ? 1 : -1;

    let s1 = 0;
    let s2 = 0;
    let c = 0;

    if (ny !== 0) {
      s1 = this.isSolidForAO(wx + sx, wy + ny, wz);
      s2 = this.isSolidForAO(wx, wy + ny, wz + sz);
      c = this.isSolidForAO(wx + sx, wy + ny, wz + sz);
    } else if (nx !== 0) {
      s1 = this.isSolidForAO(wx + nx, wy + sy, wz);
      s2 = this.isSolidForAO(wx + nx, wy, wz + sz);
      c = this.isSolidForAO(wx + nx, wy + sy, wz + sz);
    } else {
      s1 = this.isSolidForAO(wx + sx, wy, wz + nz);
      s2 = this.isSolidForAO(wx, wy + sy, wz + nz);
      c = this.isSolidForAO(wx + sx, wy + sy, wz + nz);
    }

    const occ = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
    return AO_CURVE[occ];
  }

  public rebuildChunkMesh(chunk: ChunkData): void {
    // Dispose old geometries
    if (chunk.opaqueMesh) {
      chunk.opaqueMesh.geometry.dispose();
      this.group.remove(chunk.opaqueMesh);
      chunk.opaqueMesh = null;
    }
    if (chunk.cutoutMesh) {
      chunk.cutoutMesh.geometry.dispose();
      this.group.remove(chunk.cutoutMesh);
      chunk.cutoutMesh = null;
    }
    if (chunk.waterMesh) {
      chunk.waterMesh.geometry.dispose();
      this.group.remove(chunk.waterMesh);
      chunk.waterMesh = null;
    }

    const opPos: number[] = [];
    const opNorm: number[] = [];
    const opUv: number[] = [];
    const opCol: number[] = [];
    const opIdx: number[] = [];

    const cutPos: number[] = [];
    const cutNorm: number[] = [];
    const cutUv: number[] = [];
    const cutCol: number[] = [];
    const cutIdx: number[] = [];

    const watPos: number[] = [];
    const watNorm: number[] = [];
    const watUv: number[] = [];
    const watIdx: number[] = [];

    const startX = chunk.cx * CHUNK_W;
    const startZ = chunk.cz * CHUNK_D;
    const tileStep = 1 / ATLAS_GRID;
    const eps = 0.0022; // UV inset to prevent atlas bleed with LinearFilter

    const pushFace = (
      posArr: number[],
      normArr: number[],
      uvArr: number[],
      colArr: number[] | null,
      idxArr: number[],
      wx: number,
      wy: number,
      wz: number,
      face: (typeof FACE_DIRS)[number],
      tileIndex: number,
      computeAO: boolean,
      scaleY = 1,
      scaleXZ = 1
    ) => {
      const baseVertex = posArr.length / 3;
      const tx = tileIndex % ATLAS_GRID;
      const ty = Math.floor(tileIndex / ATLAS_GRID);
      const u0 = tx * tileStep + eps;
      const u1 = (tx + 1) * tileStep - eps;
      const v1 = 1 - ty * tileStep - eps;
      const v0 = 1 - (ty + 1) * tileStep + eps;

      const [nx, ny, nz] = face.dir;
      const aos: number[] = [1, 1, 1, 1];
      const padXZ = (1 - scaleXZ) * 0.5;

      for (let i = 0; i < 4; i++) {
        const [cx, cy, cz] = face.corners[i];
        posArr.push(
          wx + padXZ + cx * scaleXZ,
          wy + cy * scaleY,
          wz + padXZ + cz * scaleXZ
        );
        normArr.push(nx, ny, nz);

        const [lu, lv] = face.uvs[i];
        uvArr.push(lu === 0 ? u0 : u1, lv === 0 ? v0 : v1);

        if (colArr) {
          const ao = computeAO ? this.vertexAO(wx, wy, wz, nx, ny, nz, cx, cy, cz) : 1.0;
          aos[i] = ao;
          const b = (0.72 + face.shade * 0.28) * ao;
          colArr.push(b, b, b);
        }
      }

      if (aos[0] + aos[2] > aos[1] + aos[3]) {
        idxArr.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
      } else {
        idxArr.push(baseVertex + 1, baseVertex + 2, baseVertex + 3, baseVertex + 1, baseVertex + 3, baseVertex);
      }
    };

    for (let y = 0; y < CHUNK_H; y++) {
      for (let lz = 0; lz < CHUNK_D; lz++) {
        const wz = startZ + lz;
        for (let lx = 0; lx < CHUNK_W; lx++) {
          const id = chunk.blocks[this.blockIndex(lx, y, lz)] as BlockId;
          if (id === BlockId.AIR) continue;

          const def = BLOCK_DEFS[id];
          if (!def) continue;
          const wx = startX + lx;

          if (id === BlockId.WATER) {
            const above = this.getBlock(wx, y + 1, wz);
            const waterScaleY = above === BlockId.WATER ? 1.0 : 0.88;
            for (const face of FACE_DIRS) {
              const nbId = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
              if (nbId === BlockId.WATER) continue;
              const nbDef = BLOCK_DEFS[nbId];
              if (nbDef && nbDef.solid && !nbDef.transparent) continue;

              const baseVertex = watPos.length / 3;
              for (let i = 0; i < 4; i++) {
                const [cx, cy, cz] = face.corners[i];
                const vx = wx + cx;
                const vy = y + cy * waterScaleY;
                const vz = wz + cz;
                watPos.push(vx, vy, vz);
                watNorm.push(face.dir[0], face.dir[1], face.dir[2]);
                // World-space tiling UVs so ocean ripples flow seamlessly across blocks
                if (face.dir[1] !== 0) {
                  watUv.push(vx * 0.25, vz * 0.25);
                } else {
                  watUv.push((vx + vz) * 0.25, vy * 0.25);
                }
              }
              watIdx.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
            }
            continue;
          }

          if (id === BlockId.LAVA) {
            const above = this.getBlock(wx, y + 1, wz);
            const lavaScaleY = above === BlockId.LAVA ? 1.0 : 0.88;
            const lavaTile = def.texTop ?? 54;
            for (const face of FACE_DIRS) {
              const nbId = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
              if (nbId === BlockId.LAVA) continue;
              const nbDef = BLOCK_DEFS[nbId];
              if (nbDef && nbDef.solid && !nbDef.transparent) continue;
              pushFace(opPos, opNorm, opUv, opCol, opIdx, wx, y, wz, face, lavaTile, false, lavaScaleY, 1);
            }
            continue;
          }

          if (id === BlockId.NETHER_PORTAL) {
            const portalTile = def.texSide ?? 55;
            for (const face of FACE_DIRS) {
              const nbId = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
              if (nbId === BlockId.NETHER_PORTAL) continue;
              const nbDef = BLOCK_DEFS[nbId];
              if (nbDef && nbDef.solid && !nbDef.transparent) continue;
              pushFace(cutPos, cutNorm, cutUv, cutCol, cutIdx, wx, y, wz, face, portalTile, false, 1, 0.34);
            }
            continue;
          }

          if (id === BlockId.TORCH) {
            const tile = def.texSide ?? 22;
            for (const face of FACE_DIRS) {
              pushFace(cutPos, cutNorm, cutUv, cutCol, cutIdx, wx, y, wz, face, tile, false, 0.65, 0.18);
            }
            continue;
          }

          if (id === BlockId.GLOW_VINE) {
            const tile = def.texSide ?? 49;
            // Render crossed thin hanging vine planes (+Z/-Z and +X/-X through block center)
            for (const face of FACE_DIRS) {
              if (face.faceType !== 'side') continue;
              pushFace(cutPos, cutNorm, cutUv, cutCol, cutIdx, wx, y, wz, face, tile, false, 1.0, 0.42);
            }
            continue;
          }

          const isCutout = def.transparent;
          for (const face of FACE_DIRS) {
            const nbId = this.getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            const nbDef = BLOCK_DEFS[nbId];

            if (!isCutout) {
              if (nbDef && nbDef.solid && !nbDef.transparent) continue;
            } else {
              // For glass/leaves: cull between identical glass blocks, keep leaves visible
              if (id === BlockId.GLASS && nbId === BlockId.GLASS) continue;
              if (nbDef && nbDef.solid && !nbDef.transparent) continue;
            }

            const tile =
              face.faceType === 'top'
                ? (def.texTop ?? 0)
                : face.faceType === 'bottom'
                  ? (def.texBottom ?? def.texTop ?? 0)
                  : (def.texSide ?? def.texTop ?? 0);

            if (isCutout) {
              pushFace(cutPos, cutNorm, cutUv, cutCol, cutIdx, wx, y, wz, face, tile, false);
            } else {
              pushFace(opPos, opNorm, opUv, opCol, opIdx, wx, y, wz, face, tile, true);
            }
          }
        }
      }
    }

    if (opIdx.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(opPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(opNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(opUv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(opCol, 3));
      geo.setIndex(opIdx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.opaqueMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chunk.opaqueMesh = mesh;
      this.group.add(mesh);
    }

    if (cutIdx.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(cutPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(cutNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(cutUv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cutCol, 3));
      geo.setIndex(cutIdx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.cutoutMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chunk.cutoutMesh = mesh;
      this.group.add(mesh);
    }

    if (watIdx.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(watPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(watNorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(watUv, 2));
      geo.setIndex(watIdx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.waterMat);
      mesh.receiveShadow = true;
      chunk.waterMesh = mesh;
      this.group.add(mesh);
    }

    chunk.dirty = false;
  }

  public updateChunksAround(playerX: number, playerZ: number, renderDistance: number, maxBuildsPerFrame = 3): void {
    const pcx = Math.floor(playerX / CHUNK_W);
    const pcz = Math.floor(playerZ / CHUNK_D);

    // Unload distant chunks to keep memory & draw calls bounded while preserving modifiedBlocks
    const unloadDist = renderDistance + 2;
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - pcx) > unloadDist || Math.abs(chunk.cz - pcz) > unloadDist) {
        if (chunk.opaqueMesh) {
          chunk.opaqueMesh.geometry.dispose();
          this.group.remove(chunk.opaqueMesh);
        }
        if (chunk.cutoutMesh) {
          chunk.cutoutMesh.geometry.dispose();
          this.group.remove(chunk.cutoutMesh);
        }
        if (chunk.waterMesh) {
          chunk.waterMesh.geometry.dispose();
          this.group.remove(chunk.waterMesh);
        }
        this.chunks.delete(key);
      }
    }

    // Generate needed chunks sorted closest-first
    const candidates: { cx: number; cz: number; distSq: number }[] = [];
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        if (dx * dx + dz * dz > renderDistance * renderDistance + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = this.chunkKey(cx, cz);
        const existing = this.chunks.get(key);
        if (!existing || existing.dirty) {
          candidates.push({ cx, cz, distSq: dx * dx + dz * dz });
        }
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);

    let built = 0;
    for (const cand of candidates) {
      const key = this.chunkKey(cand.cx, cand.cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = this.generateChunk(cand.cx, cand.cz);
      }
      if (chunk.dirty) {
        this.rebuildChunkMesh(chunk);
        built++;
        if (built >= maxBuildsPerFrame) break;
      }
    }
  }

  public getSurfaceY(wx: number, wz: number): number {
    const x = Math.floor(wx);
    const z = Math.floor(wz);
    const cx = Math.floor(x / CHUNK_W);
    const cz = Math.floor(z / CHUNK_D);
    if (!this.chunks.has(this.chunkKey(cx, cz))) {
      this.generateChunk(cx, cz);
    }
    if (this.dimension === 'nether') {
      for (let y = CHUNK_H - 7; y >= NETHER_LAVA_LEVEL; y--) {
        const id = this.getBlock(x, y, z);
        const def = BLOCK_DEFS[id];
        if (
          def &&
          def.solid &&
          this.getBlock(x, y + 1, z) === BlockId.AIR &&
          this.getBlock(x, y + 2, z) === BlockId.AIR
        ) {
          return y + 1;
        }
      }
      return 22;
    }
    for (let y = CHUNK_H - 1; y >= 1; y--) {
      const id = this.getBlock(x, y, z);
      const def = BLOCK_DEFS[id];
      if (def && def.solid) {
        return y + 1;
      }
    }
    return this.worldType === 'skyblock' ||
      this.worldType === 'oneblock' ||
      this.worldType === 'parkour' ||
      this.worldType === 'parkour100' ||
      this.worldType === 'wouldyourather'
      ? 0
      : SEA_LEVEL + 2;
  }

  public dispose() {
    for (const chunk of this.chunks.values()) {
      if (chunk.opaqueMesh) chunk.opaqueMesh.geometry.dispose();
      if (chunk.cutoutMesh) chunk.cutoutMesh.geometry.dispose();
      if (chunk.waterMesh) chunk.waterMesh.geometry.dispose();
    }
    this.chunks.clear();
  }
}
