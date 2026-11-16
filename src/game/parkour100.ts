import { BlockId } from './types';

export interface Parkour100Level {
  level: number; // 0 = Start Plaza, 1..100 = course levels
  zone: string;
  x0: number;
  x1: number;
  y: number;
  z0: number;
  z1: number;
  blockId: BlockId;
  subBlockId?: BlockId;
  accentId?: BlockId;
  isMilestone: boolean;
}

const ZONES: { name: string; primary: BlockId; secondary: BlockId; accent: BlockId }[] = [
  { name: 'Emerald Meadow', primary: BlockId.GRASS, secondary: BlockId.DIRT, accent: BlockId.OAK_PLANKS },
  { name: 'Oak Canopy', primary: BlockId.OAK_PLANKS, secondary: BlockId.OAK_LOG, accent: BlockId.LEAVES },
  { name: 'Sunlit Dunes', primary: BlockId.SANDSTONE, secondary: BlockId.SAND, accent: BlockId.GOLD_BLOCK },
  { name: 'Crimson Bastion', primary: BlockId.BRICK, secondary: BlockId.STONE, accent: BlockId.GLASS },
  { name: 'Alpine Frost', primary: BlockId.SNOW, secondary: BlockId.COBBLESTONE, accent: BlockId.IRON_BLOCK },
  { name: 'Deep Hollows', primary: BlockId.CAVE_MOSS, secondary: BlockId.DEEPSLATE, accent: BlockId.DRIPSTONE },
  { name: 'Crystal Grotto', primary: BlockId.DEEPSLATE, secondary: BlockId.CRYSTAL_CLUSTER, accent: BlockId.GLOWSTONE },
  { name: 'The Nether', primary: BlockId.NETHER_BRICKS, secondary: BlockId.NETHERRACK, accent: BlockId.SOUL_SAND },
  { name: 'Obsidian Void', primary: BlockId.OBSIDIAN, secondary: BlockId.DEEPSLATE, accent: BlockId.GLOWSTONE },
  { name: 'Diamond Summit', primary: BlockId.EMERALD_BLOCK, secondary: BlockId.DIAMOND_BLOCK, accent: BlockId.GOLD_BLOCK },
];

function deterministicRand(seed: number): number {
  let x = (seed * 374761393 + 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function buildParkour100Course(): Parkour100Level[] {
  const levels: Parkour100Level[] = [];

  // Level 0: Start Plaza around (0, 31, 0), stand at y = 32
  levels.push({
    level: 0,
    zone: 'Start Plaza',
    x0: -2,
    x1: 2,
    y: 31,
    z0: -2,
    z1: 2,
    blockId: BlockId.OAK_PLANKS,
    subBlockId: BlockId.COBBLESTONE,
    accentId: BlockId.EMERALD_BLOCK,
    isMilestone: true,
  });

  let prevX = 0;
  let prevY = 31;
  let prevZ0 = -2;

  for (let lvl = 1; lvl <= 100; lvl++) {
    const zoneIdx = Math.min(9, Math.floor((lvl - 1) / 10));
    const zone = ZONES[zoneIdx];
    const isMilestone = lvl % 10 === 0;
    const isFinal = lvl === 100;

    const r1 = deterministicRand(lvl * 17 + 3);
    const r2 = deterministicRand(lvl * 31 + 11);
    const r3 = deterministicRand(lvl * 47 + 19);

    // Smooth elevation wave: starts ~31, climbs in gentle waves up to 54 at Level 100
    const targetY =
      lvl >= 90
        ? Math.min(54, Math.round(44 + ((lvl - 90) / 10) * 10))
        : Math.round(31 + Math.sin(lvl * 0.22) * 7 + (lvl / 100) * 14);

    let dy = 0;
    if (isFinal) {
      dy = Math.max(-1, Math.min(1, targetY - prevY));
    } else if (targetY > prevY) {
      dy = 1;
    } else if (targetY < prevY && r2 > 0.35) {
      dy = -1;
    } else if (r2 > 0.72) {
      dy = 1;
    } else if (r2 < 0.18) {
      dy = -1;
    }
    const y = Math.max(22, Math.min(54, prevY + dy));

    // Platform footprint: 3x3 on milestones, 7x7 on level 100 summit, 1x1..2x2 on normal steps
    const width = isFinal ? 7 : isMilestone ? 3 : lvl > 55 && r3 > 0.58 ? 1 : 2;
    const depth = isFinal ? 7 : isMilestone ? 3 : lvl > 40 && r1 > 0.62 ? 1 : 2;

    // Gentle serpentine X wander between -11 and +11
    const waveX = Math.round(Math.sin(lvl * 0.27) * 9);
    const desiredDx = Math.max(-2, Math.min(2, waveX - prevX + (r1 > 0.66 ? 1 : r1 < 0.33 ? -1 : 0)));
    const maxLateral = dy > 0 ? 1 : 2;
    const dx = Math.max(-maxLateral, Math.min(maxLateral, desiredDx));
    const cx = Math.max(-11, Math.min(11, prevX + dx));

    // Edge-to-edge Z air gap: 1..3 blocks depending on elevation change & difficulty
    // airGap = 1 -> center step = z1 = prevZ0 - 2
    // airGap = 2 -> z1 = prevZ0 - 3
    // airGap = 3 -> z1 = prevZ0 - 4 (only when dy <= 0 and |dx| <= 1)
    let airGap = 2;
    if (dy > 0) {
      airGap = Math.abs(dx) >= 1 && lvl < 40 ? 1 : r3 > 0.65 && Math.abs(dx) === 0 ? 2 : 1;
      if (lvl > 25 && Math.abs(dx) === 0 && r3 > 0.35) airGap = 2;
    } else if (isMilestone || isFinal) {
      airGap = 2;
    } else if (lvl > 35 && dy <= 0 && Math.abs(dx) <= 1 && r2 > 0.58) {
      airGap = 3;
    } else if (r1 < 0.28) {
      airGap = 1;
    }

    const z1 = prevZ0 - (airGap + 1);
    const z0 = z1 - (depth - 1);
    const halfW = Math.floor(width / 2);
    const x0 = cx - halfW;
    const x1 = x0 + width - 1;

    // Alternate block materials for visual rhythm within each zone
    let blockId = zone.primary;
    if (isMilestone) {
      blockId = lvl === 100 ? BlockId.DIAMOND_BLOCK : BlockId.COBBLESTONE;
    } else if (lvl % 3 === 0) {
      blockId = zone.accent;
    } else if (lvl % 2 === 0 && zone.secondary !== BlockId.SOUL_SAND) {
      blockId = zone.secondary;
    }
    // Never slow jumps on Soul Sand before a 3-block gap; only place Soul Sand on short gaps
    if (blockId === BlockId.SOUL_SAND && airGap > 1) {
      blockId = zone.primary;
    }

    levels.push({
      level: lvl,
      zone: zone.name,
      x0,
      x1,
      y,
      z0,
      z1,
      blockId,
      subBlockId: zone.secondary,
      accentId: zone.accent,
      isMilestone,
    });

    prevX = Math.round((x0 + x1) / 2);
    prevY = y;
    prevZ0 = z0;
  }

  return levels;
}

export const PARKOUR_100_LEVELS: Parkour100Level[] = buildParkour100Course();
export const PARKOUR_100_MIN_Z = PARKOUR_100_LEVELS[PARKOUR_100_LEVELS.length - 1].z0 - 4;
