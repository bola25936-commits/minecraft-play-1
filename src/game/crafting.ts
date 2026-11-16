import { BlockId, InventorySlot } from './types';

export type RecipeCategory = 'craft' | 'smelt';

export interface CraftingRecipe {
  id: string;
  name: string;
  category: RecipeCategory;
  output: InventorySlot;
  requiresTable: boolean; // true = needs 3x3 crafting table, false = works in 2x2 inventory (or furnace for smelt)
  // Pattern rows (strings of 1-3 chars, ' ' = empty) OR shapeless ingredients
  pattern?: string[];
  key?: Record<string, BlockId>;
  shapeless?: { id: BlockId; count: number }[];
}

export const RECIPES: CraftingRecipe[] = [
  {
    id: 'planks',
    name: 'Oak Planks',
    category: 'craft',
    output: { id: BlockId.OAK_PLANKS, count: 4 },
    requiresTable: false,
    shapeless: [{ id: BlockId.OAK_LOG, count: 1 }],
  },
  {
    id: 'sticks',
    name: 'Sticks',
    category: 'craft',
    output: { id: BlockId.STICK, count: 4 },
    requiresTable: false,
    pattern: ['P', 'P'],
    key: { P: BlockId.OAK_PLANKS },
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    category: 'craft',
    output: { id: BlockId.CRAFTING_TABLE, count: 1 },
    requiresTable: false,
    pattern: ['PP', 'PP'],
    key: { P: BlockId.OAK_PLANKS },
  },
  {
    id: 'torch',
    name: 'Torches',
    category: 'craft',
    output: { id: BlockId.TORCH, count: 4 },
    requiresTable: false,
    pattern: ['C', 'S'],
    key: { C: BlockId.COAL, S: BlockId.STICK },
  },
  {
    id: 'furnace',
    name: 'Furnace',
    category: 'craft',
    output: { id: BlockId.FURNACE, count: 1 },
    requiresTable: true,
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: BlockId.COBBLESTONE },
  },
  {
    id: 'wood_pickaxe',
    name: 'Wooden Pickaxe',
    category: 'craft',
    output: { id: BlockId.WOOD_PICKAXE, count: 1 },
    requiresTable: true,
    pattern: ['PPP', ' S ', ' S '],
    key: { P: BlockId.OAK_PLANKS, S: BlockId.STICK },
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    category: 'craft',
    output: { id: BlockId.STONE_PICKAXE, count: 1 },
    requiresTable: true,
    pattern: ['CCC', ' S ', ' S '],
    key: { C: BlockId.COBBLESTONE, S: BlockId.STICK },
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    category: 'craft',
    output: { id: BlockId.IRON_PICKAXE, count: 1 },
    requiresTable: true,
    pattern: ['III', ' S ', ' S '],
    key: { I: BlockId.IRON_INGOT, S: BlockId.STICK },
  },
  {
    id: 'gold_pickaxe',
    name: 'Golden Pickaxe',
    category: 'craft',
    output: { id: BlockId.GOLD_PICKAXE, count: 1 },
    requiresTable: true,
    pattern: ['GGG', ' S ', ' S '],
    key: { G: BlockId.GOLD_INGOT, S: BlockId.STICK },
  },
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    category: 'craft',
    output: { id: BlockId.DIAMOND_PICKAXE, count: 1 },
    requiresTable: true,
    pattern: ['DDD', ' S ', ' S '],
    key: { D: BlockId.DIAMOND, S: BlockId.STICK },
  },
  {
    id: 'wood_sword',
    name: 'Wooden Sword',
    category: 'craft',
    output: { id: BlockId.WOOD_SWORD, count: 1 },
    requiresTable: true,
    pattern: ['P', 'P', 'S'],
    key: { P: BlockId.OAK_PLANKS, S: BlockId.STICK },
  },
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    category: 'craft',
    output: { id: BlockId.STONE_SWORD, count: 1 },
    requiresTable: true,
    pattern: ['C', 'C', 'S'],
    key: { C: BlockId.COBBLESTONE, S: BlockId.STICK },
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: 'craft',
    output: { id: BlockId.IRON_SWORD, count: 1 },
    requiresTable: true,
    pattern: ['I', 'I', 'S'],
    key: { I: BlockId.IRON_INGOT, S: BlockId.STICK },
  },
  {
    id: 'gold_sword',
    name: 'Golden Sword',
    category: 'craft',
    output: { id: BlockId.GOLD_SWORD, count: 1 },
    requiresTable: true,
    pattern: ['G', 'G', 'S'],
    key: { G: BlockId.GOLD_INGOT, S: BlockId.STICK },
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    category: 'craft',
    output: { id: BlockId.DIAMOND_SWORD, count: 1 },
    requiresTable: true,
    pattern: ['D', 'D', 'S'],
    key: { D: BlockId.DIAMOND, S: BlockId.STICK },
  },
  {
    id: 'wood_axe',
    name: 'Wooden Axe',
    category: 'craft',
    output: { id: BlockId.WOOD_AXE, count: 1 },
    requiresTable: true,
    pattern: ['PP', 'PS', ' S'],
    key: { P: BlockId.OAK_PLANKS, S: BlockId.STICK },
  },
  {
    id: 'stone_axe',
    name: 'Stone Axe',
    category: 'craft',
    output: { id: BlockId.STONE_AXE, count: 1 },
    requiresTable: true,
    pattern: ['CC', 'CS', ' S'],
    key: { C: BlockId.COBBLESTONE, S: BlockId.STICK },
  },
  {
    id: 'iron_axe',
    name: 'Iron Axe',
    category: 'craft',
    output: { id: BlockId.IRON_AXE, count: 1 },
    requiresTable: true,
    pattern: ['II', 'IS', ' S'],
    key: { I: BlockId.IRON_INGOT, S: BlockId.STICK },
  },
  {
    id: 'gold_axe',
    name: 'Golden Axe',
    category: 'craft',
    output: { id: BlockId.GOLD_AXE, count: 1 },
    requiresTable: true,
    pattern: ['GG', 'GS', ' S'],
    key: { G: BlockId.GOLD_INGOT, S: BlockId.STICK },
  },
  {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    category: 'craft',
    output: { id: BlockId.DIAMOND_AXE, count: 1 },
    requiresTable: true,
    pattern: ['DD', 'DS', ' S'],
    key: { D: BlockId.DIAMOND, S: BlockId.STICK },
  },
  {
    id: 'wood_shovel',
    name: 'Wooden Shovel',
    category: 'craft',
    output: { id: BlockId.WOOD_SHOVEL, count: 1 },
    requiresTable: true,
    pattern: ['P', 'S', 'S'],
    key: { P: BlockId.OAK_PLANKS, S: BlockId.STICK },
  },
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    category: 'craft',
    output: { id: BlockId.STONE_SHOVEL, count: 1 },
    requiresTable: true,
    pattern: ['C', 'S', 'S'],
    key: { C: BlockId.COBBLESTONE, S: BlockId.STICK },
  },
  {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    category: 'craft',
    output: { id: BlockId.IRON_SHOVEL, count: 1 },
    requiresTable: true,
    pattern: ['I', 'S', 'S'],
    key: { I: BlockId.IRON_INGOT, S: BlockId.STICK },
  },
  {
    id: 'gold_shovel',
    name: 'Golden Shovel',
    category: 'craft',
    output: { id: BlockId.GOLD_SHOVEL, count: 1 },
    requiresTable: true,
    pattern: ['G', 'S', 'S'],
    key: { G: BlockId.GOLD_INGOT, S: BlockId.STICK },
  },
  {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    category: 'craft',
    output: { id: BlockId.DIAMOND_SHOVEL, count: 1 },
    requiresTable: true,
    pattern: ['D', 'S', 'S'],
    key: { D: BlockId.DIAMOND, S: BlockId.STICK },
  },
  // Building & Decorative Blocks
  {
    id: 'chest',
    name: 'Chest',
    category: 'craft',
    output: { id: BlockId.CHEST, count: 1 },
    requiresTable: true,
    pattern: ['PPP', 'P P', 'PPP'],
    key: { P: BlockId.OAK_PLANKS },
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    category: 'craft',
    output: { id: BlockId.BOOKSHELF, count: 1 },
    requiresTable: true,
    pattern: ['PPP', 'LLL', 'PPP'],
    key: { P: BlockId.OAK_PLANKS, L: BlockId.LEATHER },
  },
  {
    id: 'tnt',
    name: 'TNT',
    category: 'craft',
    output: { id: BlockId.TNT, count: 1 },
    requiresTable: true,
    pattern: ['GSG', 'SGS', 'GSG'],
    key: { G: BlockId.GUNPOWDER, S: BlockId.SAND },
  },
  {
    id: 'wool_from_string',
    name: 'Wool Block',
    category: 'craft',
    output: { id: BlockId.WOOL, count: 1 },
    requiresTable: false,
    pattern: ['SS', 'SS'],
    key: { S: BlockId.STRING },
  },
  {
    id: 'mossy_cobble',
    name: 'Mossy Cobblestone',
    category: 'craft',
    output: { id: BlockId.MOSSY_COBBLESTONE, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.COBBLESTONE, count: 1 },
      { id: BlockId.LEAVES, count: 1 },
    ],
  },
  {
    id: 'glowstone',
    name: 'Glowstone',
    category: 'craft',
    output: { id: BlockId.GLOWSTONE, count: 2 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.TORCH, count: 2 },
      { id: BlockId.GOLD_INGOT, count: 1 },
    ],
  },
  {
    id: 'iron_block',
    name: 'Block of Iron',
    category: 'craft',
    output: { id: BlockId.IRON_BLOCK, count: 1 },
    requiresTable: true,
    pattern: ['III', 'III', 'III'],
    key: { I: BlockId.IRON_INGOT },
  },
  {
    id: 'gold_block',
    name: 'Block of Gold',
    category: 'craft',
    output: { id: BlockId.GOLD_BLOCK, count: 1 },
    requiresTable: true,
    pattern: ['GGG', 'GGG', 'GGG'],
    key: { G: BlockId.GOLD_INGOT },
  },
  {
    id: 'diamond_block',
    name: 'Block of Diamond',
    category: 'craft',
    output: { id: BlockId.DIAMOND_BLOCK, count: 1 },
    requiresTable: true,
    pattern: ['DDD', 'DDD', 'DDD'],
    key: { D: BlockId.DIAMOND },
  },
  {
    id: 'emerald_block',
    name: 'Block of Emerald',
    category: 'craft',
    output: { id: BlockId.EMERALD_BLOCK, count: 1 },
    requiresTable: true,
    pattern: ['EEE', 'EEE', 'EEE'],
    key: { E: BlockId.EMERALD },
  },
  {
    id: 'golden_apple',
    name: 'Golden Apple',
    category: 'craft',
    output: { id: BlockId.GOLDEN_APPLE, count: 1 },
    requiresTable: true,
    pattern: ['GGG', 'GAG', 'GGG'],
    key: { G: BlockId.GOLD_INGOT, A: BlockId.APPLE },
  },
  {
    id: 'sandstone',
    name: 'Sandstone',
    category: 'craft',
    output: { id: BlockId.SANDSTONE, count: 4 },
    requiresTable: false,
    pattern: ['SS', 'SS'],
    key: { S: BlockId.SAND },
  },
  {
    id: 'flint_from_gravel',
    name: 'Flint',
    category: 'craft',
    output: { id: BlockId.FLINT, count: 1 },
    requiresTable: false,
    shapeless: [{ id: BlockId.GRAVEL, count: 2 }],
  },
  {
    id: 'flint_and_steel',
    name: 'Flint and Steel',
    category: 'craft',
    output: { id: BlockId.FLINT_AND_STEEL, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.IRON_INGOT, count: 1 },
      { id: BlockId.FLINT, count: 1 },
    ],
  },
  {
    id: 'obsidian_forge',
    name: 'Obsidian',
    category: 'craft',
    output: { id: BlockId.OBSIDIAN, count: 2 },
    requiresTable: true,
    shapeless: [
      { id: BlockId.DEEPSLATE, count: 4 },
      { id: BlockId.COAL, count: 2 },
    ],
  },
  // Armor Sets (3x3 Crafting Table)
  {
    id: 'leather_helmet',
    name: 'Leather Cap',
    category: 'craft',
    output: { id: BlockId.LEATHER_HELMET, count: 1 },
    requiresTable: true,
    pattern: ['LLL', 'L L'],
    key: { L: BlockId.LEATHER },
  },
  {
    id: 'leather_chestplate',
    name: 'Leather Tunic',
    category: 'craft',
    output: { id: BlockId.LEATHER_CHESTPLATE, count: 1 },
    requiresTable: true,
    pattern: ['L L', 'LLL', 'LLL'],
    key: { L: BlockId.LEATHER },
  },
  {
    id: 'leather_leggings',
    name: 'Leather Pants',
    category: 'craft',
    output: { id: BlockId.LEATHER_LEGGINGS, count: 1 },
    requiresTable: true,
    pattern: ['LLL', 'L L', 'L L'],
    key: { L: BlockId.LEATHER },
  },
  {
    id: 'leather_boots',
    name: 'Leather Boots',
    category: 'craft',
    output: { id: BlockId.LEATHER_BOOTS, count: 1 },
    requiresTable: true,
    pattern: ['L L', 'L L'],
    key: { L: BlockId.LEATHER },
  },
  {
    id: 'iron_helmet',
    name: 'Iron Helmet',
    category: 'craft',
    output: { id: BlockId.IRON_HELMET, count: 1 },
    requiresTable: true,
    pattern: ['III', 'I I'],
    key: { I: BlockId.IRON_INGOT },
  },
  {
    id: 'iron_chestplate',
    name: 'Iron Chestplate',
    category: 'craft',
    output: { id: BlockId.IRON_CHESTPLATE, count: 1 },
    requiresTable: true,
    pattern: ['I I', 'III', 'III'],
    key: { I: BlockId.IRON_INGOT },
  },
  {
    id: 'iron_leggings',
    name: 'Iron Leggings',
    category: 'craft',
    output: { id: BlockId.IRON_LEGGINGS, count: 1 },
    requiresTable: true,
    pattern: ['III', 'I I', 'I I'],
    key: { I: BlockId.IRON_INGOT },
  },
  {
    id: 'iron_boots',
    name: 'Iron Boots',
    category: 'craft',
    output: { id: BlockId.IRON_BOOTS, count: 1 },
    requiresTable: true,
    pattern: ['I I', 'I I'],
    key: { I: BlockId.IRON_INGOT },
  },
  {
    id: 'gold_helmet',
    name: 'Golden Helmet',
    category: 'craft',
    output: { id: BlockId.GOLD_HELMET, count: 1 },
    requiresTable: true,
    pattern: ['GGG', 'G G'],
    key: { G: BlockId.GOLD_INGOT },
  },
  {
    id: 'gold_chestplate',
    name: 'Golden Chestplate',
    category: 'craft',
    output: { id: BlockId.GOLD_CHESTPLATE, count: 1 },
    requiresTable: true,
    pattern: ['G G', 'GGG', 'GGG'],
    key: { G: BlockId.GOLD_INGOT },
  },
  {
    id: 'gold_leggings',
    name: 'Golden Leggings',
    category: 'craft',
    output: { id: BlockId.GOLD_LEGGINGS, count: 1 },
    requiresTable: true,
    pattern: ['GGG', 'G G', 'G G'],
    key: { G: BlockId.GOLD_INGOT },
  },
  {
    id: 'gold_boots',
    name: 'Golden Boots',
    category: 'craft',
    output: { id: BlockId.GOLD_BOOTS, count: 1 },
    requiresTable: true,
    pattern: ['G G', 'G G'],
    key: { G: BlockId.GOLD_INGOT },
  },
  {
    id: 'diamond_helmet',
    name: 'Diamond Helmet',
    category: 'craft',
    output: { id: BlockId.DIAMOND_HELMET, count: 1 },
    requiresTable: true,
    pattern: ['DDD', 'D D'],
    key: { D: BlockId.DIAMOND },
  },
  {
    id: 'diamond_chestplate',
    name: 'Diamond Chestplate',
    category: 'craft',
    output: { id: BlockId.DIAMOND_CHESTPLATE, count: 1 },
    requiresTable: true,
    pattern: ['D D', 'DDD', 'DDD'],
    key: { D: BlockId.DIAMOND },
  },
  {
    id: 'diamond_leggings',
    name: 'Diamond Leggings',
    category: 'craft',
    output: { id: BlockId.DIAMOND_LEGGINGS, count: 1 },
    requiresTable: true,
    pattern: ['DDD', 'D D', 'D D'],
    key: { D: BlockId.DIAMOND },
  },
  {
    id: 'diamond_boots',
    name: 'Diamond Boots',
    category: 'craft',
    output: { id: BlockId.DIAMOND_BOOTS, count: 1 },
    requiresTable: true,
    pattern: ['D D', 'D D'],
    key: { D: BlockId.DIAMOND },
  },
  // Furnace-only Smelting & Cooking recipes
  {
    id: 'smelt_iron',
    name: 'Smelt Iron Ingot',
    category: 'smelt',
    output: { id: BlockId.IRON_INGOT, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.IRON_ORE, count: 1 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_gold',
    name: 'Smelt Gold Ingot',
    category: 'smelt',
    output: { id: BlockId.GOLD_INGOT, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.GOLD_ORE, count: 1 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_stone',
    name: 'Smelt Stone',
    category: 'smelt',
    output: { id: BlockId.STONE, count: 4 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.COBBLESTONE, count: 4 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_glass',
    name: 'Smelt Glass',
    category: 'smelt',
    output: { id: BlockId.GLASS, count: 4 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.SAND, count: 4 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_brick',
    name: 'Fire Bricks',
    category: 'smelt',
    output: { id: BlockId.BRICK, count: 4 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.CLAY, count: 4 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'cook_pork',
    name: 'Cook Porkchop',
    category: 'smelt',
    output: { id: BlockId.COOKED_PORK, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.RAW_PORK, count: 1 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'cook_steak',
    name: 'Cook Steak',
    category: 'smelt',
    output: { id: BlockId.STEAK, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.RAW_BEEF, count: 1 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'cook_chicken',
    name: 'Cook Chicken',
    category: 'smelt',
    output: { id: BlockId.COOKED_CHICKEN, count: 1 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.RAW_CHICKEN, count: 1 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
  {
    id: 'smelt_nether_bricks',
    name: 'Smelt Nether Bricks',
    category: 'smelt',
    output: { id: BlockId.NETHER_BRICKS, count: 4 },
    requiresTable: false,
    shapeless: [
      { id: BlockId.NETHERRACK, count: 4 },
      { id: BlockId.COAL, count: 1 },
    ],
  },
];

export const CRAFT_RECIPES: CraftingRecipe[] = RECIPES.filter((r) => r.category === 'craft');
export const SMELT_RECIPES: CraftingRecipe[] = RECIPES.filter((r) => r.category === 'smelt');

// Match a 2x2 or 3x3 crafting grid (flat array of length size*size) — crafting recipes only
export function matchCraftingGrid(
  grid: (InventorySlot | null)[],
  gridSize: 2 | 3
): CraftingRecipe | null {
  // Trim bounding box of non-empty items in grid
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;
  const itemCounts = new Map<BlockId, number>();

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const slot = grid[r * gridSize + c];
      if (slot && slot.count > 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        itemCounts.set(slot.id, (itemCounts.get(slot.id) ?? 0) + 1);
      }
    }
  }

  if (maxR < minR) return null; // empty grid

  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  for (const recipe of CRAFT_RECIPES) {
    if (recipe.requiresTable && gridSize < 3) continue;

    if (recipe.shapeless) {
      // Check exact ingredient counts (1 per slot or total matches)
      const needed = new Map<BlockId, number>();
      let totalNeeded = 0;
      for (const req of recipe.shapeless) {
        needed.set(req.id, (needed.get(req.id) ?? 0) + req.count);
        totalNeeded += req.count;
      }
      // Also support exact total counts in grid slots
      let totalInGrid = 0;
      const gridTotalCounts = new Map<BlockId, number>();
      for (let i = 0; i < grid.length; i++) {
        const s = grid[i];
        if (s && s.count > 0) {
          totalInGrid += 1;
          gridTotalCounts.set(s.id, (gridTotalCounts.get(s.id) ?? 0) + 1);
        }
      }
      if (totalInGrid === totalNeeded && gridTotalCounts.size === needed.size) {
        let match = true;
        for (const [id, cnt] of needed) {
          if (gridTotalCounts.get(id) !== cnt) {
            match = false;
            break;
          }
        }
        if (match) return recipe;
      }
    } else if (recipe.pattern && recipe.key) {
      const ph = recipe.pattern.length;
      const pw = recipe.pattern[0].length;
      if (ph !== h || pw !== w) continue;

      let match = true;
      for (let r = 0; r < ph && match; r++) {
        for (let c = 0; c < pw; c++) {
          const ch = recipe.pattern[r][c];
          const slot = grid[(minR + r) * gridSize + (minC + c)];
          if (ch === ' ') {
            if (slot && slot.count > 0) {
              match = false;
              break;
            }
          } else {
            const expectedId = recipe.key[ch];
            if (!slot || slot.id !== expectedId || slot.count < 1) {
              match = false;
              break;
            }
          }
        }
      }
      if (match) return recipe;
    }
  }

  return null;
}

export function getRecipeIngredients(recipe: CraftingRecipe): { id: BlockId; count: number }[] {
  if (recipe.shapeless) return recipe.shapeless;
  if (!recipe.pattern || !recipe.key) return [];
  const counts = new Map<BlockId, number>();
  for (const row of recipe.pattern) {
    for (const ch of row) {
      if (ch !== ' ') {
        const id = recipe.key[ch];
        if (id !== undefined) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
}

export function canCraftFromInventory(
  recipe: CraftingRecipe,
  inventory: (InventorySlot | null)[],
  gridSize: 2 | 3
): boolean {
  if (recipe.category !== 'craft') return false;
  if (recipe.requiresTable && gridSize < 3) return false;
  const reqs = getRecipeIngredients(recipe);
  const owned = new Map<BlockId, number>();
  for (const slot of inventory) {
    if (slot) owned.set(slot.id, (owned.get(slot.id) ?? 0) + slot.count);
  }
  for (const r of reqs) {
    if ((owned.get(r.id) ?? 0) < r.count) return false;
  }
  return true;
}

export function canSmeltFromInventory(
  recipe: CraftingRecipe,
  inventory: (InventorySlot | null)[]
): boolean {
  if (recipe.category !== 'smelt') return false;
  const reqs = getRecipeIngredients(recipe);
  const owned = new Map<BlockId, number>();
  for (const slot of inventory) {
    if (slot) owned.set(slot.id, (owned.get(slot.id) ?? 0) + slot.count);
  }
  for (const r of reqs) {
    if ((owned.get(r.id) ?? 0) < r.count) return false;
  }
  return true;
}
