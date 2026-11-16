import { PlayerSkin } from './skins';
import { TexturePackId } from './textures';
import { BlockId, GameMode, WorldType } from './types';

// Exact 31-digit starting balance: 1000000000000000000000000090000 MineDollars
export const STARTING_MINEDOLLARS_STR = '1000000000000000000000000090000';
export const STARTING_MINEDOLLARS = BigInt(STARTING_MINEDOLLARS_STR);

// Exact MineDollars grant button amount
export const BONUS_MINEDOLLARS_STR =
  '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
export const BONUS_MINEDOLLARS = BigInt(BONUS_MINEDOLLARS_STR);

const BALANCE_KEY = 'voxelcraft_minedollars_v1';
const OWNED_KEY = 'voxelcraft_marketplace_owned_v1';
const ACTIVE_BEHAVIORS_KEY = 'voxelcraft_active_behaviors_v1';
const ACTIVE_RESOURCE_KEY = 'voxelcraft_active_resource_v1';

export type BehaviorPackId =
  | 'lunar_gravity'
  | 'hyper_sprint'
  | 'titan_haste'
  | 'titan_strength'
  | 'vampiric_regen'
  | 'peaceful_aura'
  | 'double_loot'
  | 'mega_tnt';

export type MarketplaceCategory = 'resource' | 'behavior' | 'skins' | 'bundles';

export interface MarketplaceResourceItem {
  id: string;
  category: 'resource';
  packId: TexturePackId;
  name: string;
  tagline: string;
  description: string;
  price: bigint;
  accentColor: string;
  swatchColors: [string, string, string, string];
  badge?: string;
}

export interface MarketplaceBehaviorItem {
  id: BehaviorPackId;
  category: 'behavior';
  name: string;
  tagline: string;
  description: string;
  price: bigint;
  accentColor: string;
  badge?: string;
}

export interface MarketplaceSkinItem {
  id: string;
  category: 'skins';
  name: string;
  tagline: string;
  description: string;
  price: bigint;
  accentColor: string;
  skin: PlayerSkin;
}

export interface MarketplaceBundleItem {
  id: string;
  category: 'bundles';
  name: string;
  tagline: string;
  description: string;
  price: bigint;
  accentColor: string;
  repeatable?: boolean;
  supplyItems?: { id: BlockId; count: number }[];
  worldPreset?: {
    worldName: string;
    seed: string;
    mode: GameMode;
    worldType: WorldType;
  };
}

export type MarketplaceItem =
  | MarketplaceResourceItem
  | MarketplaceBehaviorItem
  | MarketplaceSkinItem
  | MarketplaceBundleItem;

function paintSkinRows(rows: string[], legend: Record<string, string>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    for (const ch of row) {
      out.push(legend[ch] ?? '#1b1f29');
    }
  }
  return out;
}

export const MARKETPLACE_RESOURCE_PACKS: MarketplaceResourceItem[] = [
  {
    id: 'rp_pbr',
    category: 'resource',
    packId: 'pbr',
    name: 'Ultra PBR 128px',
    tagline: 'Included Default Realism',
    description: 'High-definition 128px procedural textures with normal maps, roughness, and metallic ore gleams.',
    price: 0n,
    accentColor: '#f59e0b',
    swatchColors: ['#5cae3a', '#7d5535', '#7e8287', '#3be0eb'],
    badge: 'FREE',
  },
  {
    id: 'rp_square',
    category: 'resource',
    packId: 'square',
    name: 'Classic Square 16px',
    tagline: 'Crisp Retro Voxels',
    description: 'Clean 16×16 nearest-neighbor voxel blocks inspired by classic sandbox roots.',
    price: 0n,
    accentColor: '#10b981',
    swatchColors: ['#63b83c', '#825936', '#94a3b8', '#facc15'],
    badge: 'FREE',
  },
  {
    id: 'rp_neon_cyber',
    category: 'resource',
    packId: 'neon_cyber',
    name: 'Neon Cybergrid',
    tagline: 'Synthwave Terrain & Glow',
    description: 'Transforms blocks into dark obsidian cyber-slate with glowing cyan & magenta circuit highlights and neon skies.',
    price: 50000n,
    accentColor: '#06b6d4',
    swatchColors: ['#0f172a', '#00f5d4', '#ec4899', '#6366f1'],
    badge: 'POPULAR',
  },
  {
    id: 'rp_candy_pastel',
    category: 'resource',
    packId: 'candy_pastel',
    name: 'Sugar & Candy World',
    tagline: 'Sweet Pastel Kingdom',
    description: 'Re-colors grass to mint frosting, stone to marshmallow cream, and water into fizzy tropical turquoise.',
    price: 120000n,
    accentColor: '#f472b6',
    swatchColors: ['#7bf1a8', '#ffcad4', '#fde68a', '#67e8f9'],
    badge: 'CUTE',
  },
  {
    id: 'rp_golden_royal',
    category: 'resource',
    packId: 'golden_royal',
    name: 'Gilded Royal Marble',
    tagline: 'Sunlit Palace Aesthetics',
    description: 'Warm limestone blocks, gilded bronze earth, sapphire oceans, and radiant golden daylight.',
    price: 250000n,
    accentColor: '#eab308',
    swatchColors: ['#facc15', '#fef3c7', '#b45309', '#2563eb'],
  },
  {
    id: 'rp_crimson_nether',
    category: 'resource',
    packId: 'crimson_nether',
    name: 'Crimson Scorch Pack',
    tagline: 'Volcanic Ember Dimension',
    description: 'Scorched crimson grass, volcanic basalt stone, magma-tinted water, and dramatic ember skies.',
    price: 500000n,
    accentColor: '#ef4444',
    swatchColors: ['#dc2626', '#451a1a', '#f97316', '#7f1d1d'],
    badge: 'EPIC',
  },
  {
    id: 'rp_frost_tundra',
    category: 'resource',
    packId: 'frost_tundra',
    name: 'Frozen Arctic Frost',
    tagline: 'Glacial Ice & Permafrost',
    description: 'Blankets foliage in frost teal, turns stone to glacial sapphire ice, and chills the horizon.',
    price: 750000n,
    accentColor: '#38bdf8',
    swatchColors: ['#e0f2fe', '#7dd3fc', '#0284c7', '#475569'],
  },
  {
    id: 'rp_noir_emerald',
    category: 'resource',
    packId: 'noir_emerald',
    name: 'Noir & Emerald Comic',
    tagline: 'Monochrome + Emerald Pop',
    description: 'Dramatic black-and-white ink world where emeralds, gems, and torches blaze in vivid color.',
    price: 1200000n,
    accentColor: '#22c55e',
    swatchColors: ['#18181b', '#e4e4e7', '#10b981', '#fbbf24'],
    badge: 'LEGENDARY',
  },
];

export const MARKETPLACE_BEHAVIOR_PACKS: MarketplaceBehaviorItem[] = [
  {
    id: 'lunar_gravity',
    category: 'behavior',
    name: 'Lunar Gravity Pack',
    tagline: '45% Low-Gravity Physics',
    description: 'Soar across canyons with floaty low-gravity jumps and reduced fall damage.',
    price: 45000n,
    accentColor: '#a855f7',
    badge: 'FUN',
  },
  {
    id: 'hyper_sprint',
    category: 'behavior',
    name: 'Hyper Speed & Agility',
    tagline: '+65% Run & Sprint Velocity',
    description: 'Boosts walking, sprinting, and jump launch power for ultra-fast exploring & parkour.',
    price: 60000n,
    accentColor: '#06b6d4',
  },
  {
    id: 'peaceful_aura',
    category: 'behavior',
    name: 'Cozy Peaceful Aura',
    tagline: 'Zero Hostile Night Spawns',
    description: 'Stops hostile Zombies, Skeletons, Spiders & Stalkers from spawning or attacking at night.',
    price: 90000n,
    accentColor: '#34d399',
  },
  {
    id: 'titan_haste',
    category: 'behavior',
    name: 'Titan Haste Mining',
    tagline: '4× Faster Block Breaking',
    description: 'Supercharges mining speed across all pickaxes, axes, shovels, and bare hands.',
    price: 150000n,
    accentColor: '#f59e0b',
    badge: 'PRO',
  },
  {
    id: 'titan_strength',
    category: 'behavior',
    name: 'Titan Strength Combat',
    tagline: '3× Melee Damage & Knockback',
    description: 'Triples weapon and fist combat damage while launching hostile mobs far backward.',
    price: 180000n,
    accentColor: '#ef4444',
  },
  {
    id: 'vampiric_regen',
    category: 'behavior',
    name: 'Vampiric Fast Regen',
    tagline: 'Rapid Heal + +4 HP / Kill',
    description: 'Heals your hearts rapidly whenever fed and restores +4 HP every time you defeat a mob.',
    price: 220000n,
    accentColor: '#f43f5e',
  },
  {
    id: 'double_loot',
    category: 'behavior',
    name: 'Double Fortune Drops',
    tagline: '2× All Mined Blocks & Ores',
    description: 'Every block, ore, coal seam, and diamond you harvest drops double items!',
    price: 350000n,
    accentColor: '#38bdf8',
    badge: 'VALUE',
  },
  {
    id: 'mega_tnt',
    category: 'behavior',
    name: 'Super Demolition Pack',
    tagline: '1.85× TNT Blast + Blast Shield',
    description: 'Nearly doubles TNT crater radius while halving self-explosion damage.',
    price: 450000n,
    accentColor: '#fb923c',
  },
];

export const MARKETPLACE_SKIN_PACKS: MarketplaceSkinItem[] = [
  {
    id: 'skin_cyber_samurai',
    category: 'skins',
    name: 'Cyber Samurai',
    tagline: 'Neon Visor & Carbon Plate',
    description: 'Futuristic cyber-armor skin unlocked permanently in your Skin Maker & Wardrobe.',
    price: 35000n,
    accentColor: '#06b6d4',
    skin: {
      id: 'mp_skin_cyber_samurai',
      name: 'Cyber Samurai',
      builtIn: true,
      createdAt: 101,
      head: paintSkinRows(
        ['DDDDDDDD', 'DCBBBBCD', 'DDDDDDDD', 'DCCCCCCd', 'DCCCCCCd', 'DDDDDDDD', 'DMGGGGMD', 'DDDDDDDD'],
        { D: '#0f172a', C: '#06b6d4', d: '#0891b2', B: '#ec4899', M: '#334155', G: '#22d3ee' }
      ),
      torso: paintSkinRows(
        ['DDDDDDDD', 'DCCDDCCD', 'DDDDDDDD', 'DMGGGGMD', 'DDDDDDDD', 'DDDCCDDD', 'PPPPPPPP', 'DDDDDDDD'],
        { D: '#111827', C: '#06b6d4', M: '#334155', G: '#22d3ee', P: '#ec4899' }
      ),
      arm: paintSkinRows(
        ['DDDD', 'CCCC', 'DDDD', 'DDDD', 'MMMM', 'DDDD', 'CCCC', 'DDDD'],
        { D: '#111827', C: '#06b6d4', M: '#334155' }
      ),
      leg: paintSkinRows(
        ['DDDD', 'DDDD', 'CCDD', 'DDDD', 'DDDD', 'DDDD', 'PPPP', 'DDDD'],
        { D: '#0f172a', C: '#06b6d4', P: '#ec4899' }
      ),
    },
  },
  {
    id: 'skin_galaxy_astro',
    category: 'skins',
    name: 'Galaxy Astronaut',
    tagline: 'Gold Visor Space Suit',
    description: 'Zero-G explorer suit ready for Skyblock voids and Lunar Gravity jumps.',
    price: 55000n,
    accentColor: '#facc15',
    skin: {
      id: 'mp_skin_galaxy_astro',
      name: 'Galaxy Astronaut',
      builtIn: true,
      createdAt: 102,
      head: paintSkinRows(
        ['WWWWWWWW', 'WGGGGGGW', 'WGGGGGGW', 'WGGYYGGW', 'WGGGGGGW', 'WGGGGGGW', 'WWWWWWWW', 'SSSSSSSS'],
        { W: '#f8fafc', G: '#f59e0b', Y: '#fef08a', S: '#94a3b8' }
      ),
      torso: paintSkinRows(
        ['WWWWWWWW', 'WBBBBBBW', 'WBRWWBBW', 'WWWWWWWW', 'WSSWWSSW', 'WWWWWWWW', 'SSSSSSSS', 'WWWWWWWW'],
        { W: '#f8fafc', B: '#2563eb', R: '#ef4444', S: '#64748b' }
      ),
      arm: paintSkinRows(
        ['WWWW', 'BBBB', 'WWWW', 'WWWW', 'SSSS', 'WWWW', 'WWWW', 'SSSS'],
        { W: '#f8fafc', B: '#2563eb', S: '#64748b' }
      ),
      leg: paintSkinRows(
        ['WWWW', 'WWWW', 'WWWW', 'WWWW', 'SSSS', 'SSSS', 'BBBB', 'BBBB'],
        { W: '#f8fafc', S: '#94a3b8', B: '#334155' }
      ),
    },
  },
  {
    id: 'skin_golden_king',
    category: 'skins',
    name: 'Golden Sovereign',
    tagline: 'Royal Crown & Cape Trim',
    description: 'Regal gold-trimmed armor & royal crimson tunic fit for a MineDollars billionaire.',
    price: 125000n,
    accentColor: '#eab308',
    skin: {
      id: 'mp_skin_golden_king',
      name: 'Golden Sovereign',
      builtIn: true,
      createdAt: 103,
      head: paintSkinRows(
        ['YGYGYGYG', 'YYYYYYYY', 'HSSSSSSH', 'SSSSSSSS', 'SWBSSSBW', 'SSSSSSSS', 'SSBBBBSS', 'SSBBBBSS'],
        { Y: '#facc15', G: '#10b981', H: '#78350f', S: '#f2c29b', W: '#ffffff', B: '#2563eb' }
      ),
      torso: paintSkinRows(
        ['YYRRRRYY', 'YYRRRRYY', 'RRRRRRRR', 'RRYYYYRR', 'RRRRRRRR', 'RRRRRRRR', 'YYYYYYYY', 'RRRRRRRR'],
        { Y: '#facc15', R: '#b91c1c' }
      ),
      arm: paintSkinRows(
        ['YYYY', 'RRRR', 'RRRR', 'SSSS', 'SSSS', 'SSSS', 'YYYY', 'SSSS'],
        { Y: '#facc15', R: '#b91c1c', S: '#f2c29b' }
      ),
      leg: paintSkinRows(
        ['RRRR', 'RRRR', 'RRRR', 'RRRR', 'RRRR', 'YYYY', 'YYYY', '78350f'],
        { R: '#7f1d1d', Y: '#facc15', '78350f': '#451a03' }
      ),
    },
  },
  {
    id: 'skin_crimson_knight',
    category: 'skins',
    name: 'Crimson Paladin',
    tagline: 'Ember Visor & Steel Plate',
    description: 'Heavy ruby-forged knight armor forged for cavern & night mob raids.',
    price: 180000n,
    accentColor: '#ef4444',
    skin: {
      id: 'mp_skin_crimson_knight',
      name: 'Crimson Paladin',
      builtIn: true,
      createdAt: 104,
      head: paintSkinRows(
        ['RRRRRRRR', 'RRRRRRRR', 'RSSSSSSR', 'RSOOOOSR', 'RRRRRRRR', 'RSSSSSSR', 'RSRRRRSR', 'RRRRRRRR'],
        { R: '#991b1b', S: '#cbd5e1', O: '#f97316' }
      ),
      torso: paintSkinRows(
        ['SSRRRRSS', 'RRRRRRRR', 'RROOOORR', 'RRRRRRRR', 'SSSSSSSS', 'RRRRRRRR', 'SSRRRRSS', 'RRRRRRRR'],
        { R: '#991b1b', S: '#94a3b8', O: '#fb923c' }
      ),
      arm: paintSkinRows(
        ['RRRR', 'RRRR', 'SSSS', 'SSSS', 'RRRR', 'RRRR', 'SSSS', 'SSSS'],
        { R: '#991b1b', S: '#94a3b8' }
      ),
      leg: paintSkinRows(
        ['RRRR', 'RRRR', 'SSSS', 'RRRR', 'RRRR', 'SSSS', 'SSSS', 'DDDD'],
        { R: '#7f1d1d', S: '#64748b', D: '#1e293b' }
      ),
    },
  },
  {
    id: 'skin_frost_wizard',
    category: 'skins',
    name: 'Frost Archmage',
    tagline: 'Glacial Robes & Sapphire Eyes',
    description: 'Mystic ice-mage cloak woven from permafrost wool and glowing sapphire.',
    price: 240000n,
    accentColor: '#38bdf8',
    skin: {
      id: 'mp_skin_frost_wizard',
      name: 'Frost Archmage',
      builtIn: true,
      createdAt: 105,
      head: paintSkinRows(
        ['BBBBBBBB', 'BCCCCCCB', 'BSSSSSSB', 'SSSSSSSS', 'SBCSSCBW', 'SSSSSSSS', 'SSWWWWSS', 'SSWWWWSS'],
        { B: '#1d4ed8', C: '#38bdf8', S: '#f2c29b', W: '#e0f2fe' }
      ),
      torso: paintSkinRows(
        ['BBBBBBBB', 'BCCCCCCB', 'BBCCCCBB', 'BBBBBBBB', 'BCWWWWCB', 'BBBBBBBB', 'CCCCCCCC', 'BBBBBBBB'],
        { B: '#1e40af', C: '#38bdf8', W: '#e0f2fe' }
      ),
      arm: paintSkinRows(
        ['BBBB', 'BBBB', 'CCCC', 'BBBB', 'SSSS', 'SSSS', 'SSSS', 'SSSS'],
        { B: '#1e40af', C: '#38bdf8', S: '#f2c29b' }
      ),
      leg: paintSkinRows(
        ['BBBB', 'BBBB', 'BBBB', 'BBBB', 'CCCC', 'CCCC', 'WWWW', 'WWWW'],
        { B: '#1e3a8a', C: '#0284c7', W: '#bae6fd' }
      ),
    },
  },
  {
    id: 'skin_emerald_dragon',
    category: 'skins',
    name: 'Emerald Enderborn',
    tagline: 'Glowing Jade Scales',
    description: 'Mythic emerald-scaled warrior skin with glowing jade eyes.',
    price: 500000n,
    accentColor: '#22c55e',
    skin: {
      id: 'mp_skin_emerald_dragon',
      name: 'Emerald Enderborn',
      builtIn: true,
      createdAt: 106,
      head: paintSkinRows(
        ['DDDDDDDD', 'DGGDDGGD', 'DDDDDDDD', 'DGDDDDGD', 'DLDDDDLD', 'DDDDDDDD', 'DDGGGGDD', 'DDDDDDDD'],
        { D: '#090d12', G: '#10b981', L: '#6ee7b7' }
      ),
      torso: paintSkinRows(
        ['DDDDDDDD', 'DGGGGGGD', 'DGLLLLGD', 'DGGGGGGD', 'DDGGGGDD', 'DDDDDDDD', 'GGGGGGGG', 'DDDDDDDD'],
        { D: '#090d12', G: '#10b981', L: '#6ee7b7' }
      ),
      arm: paintSkinRows(
        ['DDDD', 'DDDD', 'GGGG', 'DDDD', 'DDDD', 'GGGG', 'LLLL', 'DDDD'],
        { D: '#090d12', G: '#10b981', L: '#6ee7b7' }
      ),
      leg: paintSkinRows(
        ['DDDD', 'DDDD', 'GGGG', 'DDDD', 'DDDD', 'DDDD', 'GGGG', 'GGGG'],
        { D: '#090d12', G: '#10b981' }
      ),
    },
  },
];

export const MARKETPLACE_BUNDLES: MarketplaceBundleItem[] = [
  {
    id: 'bundle_diamond_armor',
    category: 'bundles',
    name: 'Diamond Armor & Blade Kit',
    tagline: 'Full 20/20 Defense Loadout',
    description: 'Delivers Diamond Helmet, Chestplate, Leggings, Boots, Diamond Sword & Golden Apples straight to your inventory.',
    price: 85000n,
    accentColor: '#2dd3e0',
    repeatable: true,
    supplyItems: [
      { id: BlockId.DIAMOND_HELMET, count: 1 },
      { id: BlockId.DIAMOND_CHESTPLATE, count: 1 },
      { id: BlockId.DIAMOND_LEGGINGS, count: 1 },
      { id: BlockId.DIAMOND_BOOTS, count: 1 },
      { id: BlockId.DIAMOND_SWORD, count: 1 },
      { id: BlockId.GOLDEN_APPLE, count: 4 },
    ],
  },
  {
    id: 'bundle_builder_crate',
    category: 'bundles',
    name: "Master Builder's Crate",
    tagline: 'Stack Up & Build Massive Bases',
    description: 'Delivers Oak Planks ×64, Stone ×64, Glass ×32, Glowstone ×16, Bookshelf ×16 & Torch ×32.',
    price: 40000n,
    accentColor: '#10b981',
    repeatable: true,
    supplyItems: [
      { id: BlockId.OAK_PLANKS, count: 64 },
      { id: BlockId.STONE, count: 64 },
      { id: BlockId.GLASS, count: 32 },
      { id: BlockId.GLOWSTONE, count: 16 },
      { id: BlockId.BOOKSHELF, count: 16 },
      { id: BlockId.TORCH, count: 32 },
    ],
  },
  {
    id: 'bundle_miner_pro',
    category: 'bundles',
    name: 'Pro Miner & Smelter Kit',
    tagline: 'Diamond Tools + Fuel',
    description: 'Delivers Diamond Pickaxe, Diamond Axe, Diamond Shovel, Furnace, Coal ×32 & Steak ×16.',
    price: 110000n,
    accentColor: '#f59e0b',
    repeatable: true,
    supplyItems: [
      { id: BlockId.DIAMOND_PICKAXE, count: 1 },
      { id: BlockId.DIAMOND_AXE, count: 1 },
      { id: BlockId.DIAMOND_SHOVEL, count: 1 },
      { id: BlockId.FURNACE, count: 1 },
      { id: BlockId.COAL, count: 32 },
      { id: BlockId.STEAK, count: 16 },
    ],
  },
  {
    id: 'bundle_tnt_chaos',
    category: 'bundles',
    name: 'TNT Demolition Crate',
    tagline: 'Explosive Excavation Supplies',
    description: 'Delivers TNT ×32, Gold Ingots ×16 & Iron Armor chestpiece + helmet.',
    price: 160000n,
    accentColor: '#ef4444',
    repeatable: true,
    supplyItems: [
      { id: BlockId.TNT, count: 32 },
      { id: BlockId.GOLD_INGOT, count: 16 },
      { id: BlockId.IRON_HELMET, count: 1 },
      { id: BlockId.IRON_CHESTPLATE, count: 1 },
    ],
  },
  {
    id: 'map_crystal_fjord',
    category: 'bundles',
    name: 'Crystal Fjords Expedition',
    tagline: 'Curated Adventure World Map',
    description: 'Unlocks & launches a scenic Nordic mountain-and-fjord seed ideal for base building.',
    price: 75000n,
    accentColor: '#38bdf8',
    worldPreset: {
      worldName: 'Crystal Fjords',
      seed: 'crystal-fjords-777',
      mode: 'survival',
      worldType: 'normal',
    },
  },
  {
    id: 'map_parkour_pro',
    category: 'bundles',
    name: 'Sky Summit Parkour Arena',
    tagline: 'Floating Challenge Course',
    description: 'Unlocks & launches a dedicated Sky Parkour world ready to race with friends.',
    price: 95000n,
    accentColor: '#d946ef',
    worldPreset: {
      worldName: 'Sky Summit Arena',
      seed: 'parkour-summit-pro',
      mode: 'survival',
      worldType: 'parkour',
    },
  },
];

export const ALL_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  ...MARKETPLACE_RESOURCE_PACKS,
  ...MARKETPLACE_BEHAVIOR_PACKS,
  ...MARKETPLACE_SKIN_PACKS,
  ...MARKETPLACE_BUNDLES,
];

const DEFAULT_OWNED_IDS = ['rp_pbr', 'rp_square'];

export function loadMineDollars(): bigint {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw && /^\d+$/.test(raw.trim())) {
      return BigInt(raw.trim());
    }
  } catch {
    // ignore storage failures
  }
  return STARTING_MINEDOLLARS;
}

export function saveMineDollars(balance: bigint): void {
  try {
    localStorage.setItem(BALANCE_KEY, balance.toString());
  } catch {
    // ignore
  }
}

export function loadOwnedMarketplaceIds(): string[] {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    if (!raw) return [...DEFAULT_OWNED_IDS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const merged = new Set([...DEFAULT_OWNED_IDS, ...parsed.filter((x) => typeof x === 'string')]);
      return Array.from(merged);
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_OWNED_IDS];
}

export function saveOwnedMarketplaceIds(ids: string[]): void {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadActiveBehaviorPacks(): BehaviorPackId[] {
  try {
    const raw = localStorage.getItem(ACTIVE_BEHAVIORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is BehaviorPackId => typeof x === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveActiveBehaviorPacks(packs: BehaviorPackId[]): void {
  try {
    localStorage.setItem(ACTIVE_BEHAVIORS_KEY, JSON.stringify(packs));
  } catch {
    // ignore
  }
}

export function loadActiveResourcePack(): TexturePackId {
  try {
    const raw = localStorage.getItem(ACTIVE_RESOURCE_KEY);
    if (
      raw === 'pbr' ||
      raw === 'square' ||
      raw === 'neon_cyber' ||
      raw === 'candy_pastel' ||
      raw === 'golden_royal' ||
      raw === 'crimson_nether' ||
      raw === 'frost_tundra' ||
      raw === 'noir_emerald'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'pbr';
}

export function saveActiveResourcePack(pack: TexturePackId): void {
  try {
    localStorage.setItem(ACTIVE_RESOURCE_KEY, pack);
  } catch {
    // ignore
  }
}

export function formatMineDollarsExact(amount: bigint): string {
  const s = amount.toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMineDollarsCompact(amount: bigint): string {
  const s = amount.toString();
  if (s.length <= 9) return formatMineDollarsExact(amount);
  // Show leading 3 digits + ... + trailing 6 digits (so ...090,000 stays visible!)
  return `${s.slice(0, 4)}...${s.slice(-6)}`;
}
