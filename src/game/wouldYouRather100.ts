import { BlockId } from './types';

export interface WouldYouRatherLevel {
  level: number; // 0 = Start Plaza, 1..100 = dilemma levels, 101 = Champion Summit
  chapter: string;
  optionA: string;
  optionB: string;
  rewardA?: { id: BlockId; count: number };
  rewardB?: { id: BlockId; count: number };
  y: number;
  entryZ1: number; // south-facing start edge of this stage (bigger Z)
  entryZ0: number; // north-facing end edge of entry pad
  forkZ1: number; // start of A / B pads
  forkZ0: number; // end of A / B pads
  exitZ1: number; // rejoin bridge start
  exitZ0: number; // rejoin bridge end
  matA: BlockId;
  matB: BlockId;
  trimMat: BlockId;
  isMilestone: boolean;
}

interface QuestionSeed {
  chapter: string;
  a: string;
  b: string;
  ra?: [BlockId, number];
  rb?: [BlockId, number];
}

const QUESTIONS: QuestionSeed[] = [
  // 1-10: Starter Survival
  { chapter: 'Starter Survival', a: 'Start with a Diamond Pickaxe', b: 'Start with 16 Golden Apples', ra: [BlockId.DIAMOND_PICKAXE, 1], rb: [BlockId.GOLDEN_APPLE, 2] },
  { chapter: 'Starter Survival', a: 'Live in an Oak Treehouse', b: 'Live in an Underground Bunker', ra: [BlockId.OAK_PLANKS, 4], rb: [BlockId.COBBLESTONE, 4] },
  { chapter: 'Starter Survival', a: 'Only eat Apples forever', b: 'Only eat Steak forever', ra: [BlockId.APPLE, 3], rb: [BlockId.STEAK, 2] },
  { chapter: 'Starter Survival', a: 'Spawn in a Snowy Mountain', b: 'Spawn in a Huge Desert', ra: [BlockId.SNOW, 4], rb: [BlockId.SANDSTONE, 4] },
  { chapter: 'Starter Survival', a: 'Always have Daytime', b: 'Always have Starry Night', ra: [BlockId.GLOWSTONE, 1], rb: [BlockId.TORCH, 4] },
  { chapter: 'Starter Survival', a: 'Never take Fall Damage', b: 'Breathe Underwater forever', ra: [BlockId.FEATHER, 3], rb: [BlockId.GLASS, 4] },
  { chapter: 'Starter Survival', a: 'Own 100 Pet Wolves', b: 'Own 100 Pet Chickens', ra: [BlockId.BONE, 3], rb: [BlockId.FEATHER, 4] },
  { chapter: 'Starter Survival', a: 'Run 2x Faster', b: 'Jump 2x Higher', ra: [BlockId.LEATHER_BOOTS, 1], rb: [BlockId.WOOL, 4] },
  { chapter: 'Starter Survival', a: 'Build only with Glass', b: 'Build only with Obsidian', ra: [BlockId.GLASS, 6], rb: [BlockId.OBSIDIAN, 2] },
  { chapter: 'Starter Survival', a: 'Find a Hidden Chest of Gold', b: 'Find a Secret Diamond Vein', ra: [BlockId.GOLD_INGOT, 3], rb: [BlockId.DIAMOND, 1] },

  // 11-20: Mob Mania
  { chapter: 'Mob Mania', a: 'Fight 10 Zombies with a Stick', b: 'Fight 1 Giant Skeleton Archer', ra: [BlockId.STICK, 4], rb: [BlockId.BONE, 3] },
  { chapter: 'Mob Mania', a: 'Have a Friendly Stalker Bodyguard', b: 'Have a Pet Skeleton Sniper', ra: [BlockId.GUNPOWDER, 2], rb: [BlockId.BONE, 2] },
  { chapter: 'Mob Mania', a: 'Ride a Super-Fast Pig', b: 'Fly on a Giant Chicken', ra: [BlockId.COOKED_PORK, 2], rb: [BlockId.COOKED_CHICKEN, 2] },
  { chapter: 'Mob Mania', a: 'Spiders are 2x Bigger', b: 'Zombies sprint like Cheetahs', ra: [BlockId.STRING, 3], rb: [BlockId.IRON_SWORD, 1] },
  { chapter: 'Mob Mania', a: 'All Cows drop Diamonds', b: 'All Sheep drop Gold Blocks', ra: [BlockId.DIAMOND, 1], rb: [BlockId.GOLD_BLOCK, 1] },
  { chapter: 'Mob Mania', a: 'Stalkers explode Confetti', b: 'Skeletons shoot Fireworks', ra: [BlockId.TNT, 2], rb: [BlockId.GLOWSTONE, 2] },
  { chapter: 'Mob Mania', a: 'Turn into a Wolf at Night', b: 'Turn into a Bird during Day', ra: [BlockId.RAW_BEEF, 2], rb: [BlockId.FEATHER, 4] },
  { chapter: 'Mob Mania', a: 'Trade with Villagers anywhere', b: 'Summon Iron Guards anywhere', ra: [BlockId.EMERALD, 2], rb: [BlockId.IRON_BLOCK, 1] },
  { chapter: 'Mob Mania', a: 'Every Spider is Friendly', b: 'Every Wolf has Diamond Armor', ra: [BlockId.STRING, 4], rb: [BlockId.DIAMOND_HELMET, 1] },
  { chapter: 'Mob Mania', a: 'Tame a Fire Blaze Pet', b: 'Tame a Crystal Golem', ra: [BlockId.GLOWSTONE, 2], rb: [BlockId.CRYSTAL_CLUSTER, 2] },

  // 21-30: Mining & Treasures
  { chapter: 'Mining & Treasures', a: 'X-Ray Vision for Diamonds', b: 'Mine Every Block in 1 Hit', ra: [BlockId.DIAMOND, 2], rb: [BlockId.GOLD_PICKAXE, 1] },
  { chapter: 'Mining & Treasures', a: 'Infinite Coal & Torches', b: 'Infinite Iron Ingots', ra: [BlockId.TORCH, 8], rb: [BlockId.IRON_INGOT, 3] },
  { chapter: 'Mining & Treasures', a: 'Explore a Crystal Cavern', b: 'Explore a Lush Glow Grotto', ra: [BlockId.CRYSTAL_CLUSTER, 2], rb: [BlockId.CAVE_MOSS, 4] },
  { chapter: 'Mining & Treasures', a: 'Lava turns into Water near you', b: 'Water turns into Ice near you', ra: [BlockId.OBSIDIAN, 2], rb: [BlockId.SNOW, 4] },
  { chapter: 'Mining & Treasures', a: 'Find 64 Emeralds right now', b: 'Find Full Iron Armor right now', ra: [BlockId.EMERALD, 4], rb: [BlockId.IRON_CHESTPLATE, 1] },
  { chapter: 'Mining & Treasures', a: 'Inventory has 100 Slots', b: 'Stack size goes up to 999', ra: [BlockId.CHEST, 1], rb: [BlockId.BOOKSHELF, 1] },
  { chapter: 'Mining & Treasures', a: 'Never lose Items on Death', b: 'Keep XP & Tools Forever', ra: [BlockId.IRON_PICKAXE, 1], rb: [BlockId.DIAMOND_AXE, 1] },
  { chapter: 'Mining & Treasures', a: 'Dig straight down safely', b: 'Smelt Ores with your Hands', ra: [BlockId.DIAMOND_SHOVEL, 1], rb: [BlockId.FURNACE, 1] },
  { chapter: 'Mining & Treasures', a: 'One Enchanted Gold Sword', b: 'Full Set of Leather & Iron Gear', ra: [BlockId.GOLD_SWORD, 1], rb: [BlockId.IRON_BOOTS, 1] },
  { chapter: 'Mining & Treasures', a: 'Unlock a Floating Ore Asteroid', b: 'Unlock a Deep Deepslate Vault', ra: [BlockId.GOLD_ORE, 3], rb: [BlockId.DEEPSLATE, 4] },

  // 31-40: Sky & Parkour
  { chapter: 'Sky & Parkour', a: 'Beat 100-Lvl Parkour Blindfolded', b: 'Survive One Block for 30 Days', ra: [BlockId.GOLD_BLOCK, 1], rb: [BlockId.GRASS, 4] },
  { chapter: 'Sky & Parkour', a: 'Double-Jump in Survival', b: 'Wall-Climb like a Spider', ra: [BlockId.FEATHER, 5], rb: [BlockId.GLOW_VINE, 3] },
  { chapter: 'Sky & Parkour', a: 'Bridge across Skyblock on Ice', b: 'Parkour over Lava Lakes', ra: [BlockId.GLASS, 6], rb: [BlockId.NETHER_BRICKS, 4] },
  { chapter: 'Sky & Parkour', a: 'No Knockback from anything', b: 'Bounce back from Void falls', ra: [BlockId.OBSIDIAN, 2], rb: [BlockId.WOOL, 4] },
  { chapter: 'Sky & Parkour', a: 'Walk on Clouds above World', b: 'Swim through Glowing Caves', ra: [BlockId.WOOL, 6], rb: [BlockId.CRYSTAL_CLUSTER, 2] },
  { chapter: 'Sky & Parkour', a: 'Grappling Hook with String', b: 'Jetpack with Gunpowder', ra: [BlockId.STRING, 4], rb: [BlockId.GUNPOWDER, 4] },
  { chapter: 'Sky & Parkour', a: '1-Block Gaps only for 1 Mile', b: '1 Giant 5-Block Mega Jump', ra: [BlockId.OAK_PLANKS, 4], rb: [BlockId.EMERALD_BLOCK, 1] },
  { chapter: 'Sky & Parkour', a: 'Every Landing spawns Flowers', b: 'Every Jump spawns Sparkles', ra: [BlockId.CAVE_MOSS, 3], rb: [BlockId.GLOWSTONE, 2] },
  { chapter: 'Sky & Parkour', a: 'Checkpoint after Every Jump', b: '3x Reward for No Checkpoints', ra: [BlockId.TORCH, 4], rb: [BlockId.DIAMOND, 2] },
  { chapter: 'Sky & Parkour', a: 'Sky Castle in the Clouds', b: 'Submarine Base under Ocean', ra: [BlockId.BRICK, 4], rb: [BlockId.GLASS, 6] },

  // 41-50: Wild Food & Potions
  { chapter: 'Wild Food & Potions', a: 'Eat Bread that heals Full HP', b: 'Eat Steak that gives Speed Boost', ra: [BlockId.BREAD, 3], rb: [BlockId.STEAK, 2] },
  { chapter: 'Wild Food & Potions', a: 'Golden Apples grow on Oak Trees', b: 'Diamonds drop from Wheat & Leaves', ra: [BlockId.GOLDEN_APPLE, 1], rb: [BlockId.DIAMOND, 1] },
  { chapter: 'Wild Food & Potions', a: 'Never get Hungry again', b: 'Regenerate Health 3x Faster', ra: [BlockId.COOKED_PORK, 2], rb: [BlockId.APPLE, 4] },
  { chapter: 'Wild Food & Potions', a: 'Spicy Cactus Juice', b: 'Icy Alpine Berry Smoothies', ra: [BlockId.CACTUS, 2], rb: [BlockId.SNOW, 4] },
  { chapter: 'Wild Food & Potions', a: 'Cooked Chicken Rain for 1 Hour', b: 'Floating Golden Apple Piñata', ra: [BlockId.COOKED_CHICKEN, 3], rb: [BlockId.GOLDEN_APPLE, 1] },
  { chapter: 'Wild Food & Potions', a: '100-Layer Cake Tower', b: '100-Gallon Lava Fountain', ra: [BlockId.WOOL, 4], rb: [BlockId.NETHERRACK, 4] },
  { chapter: 'Wild Food & Potions', a: 'Eat Only Crunchy Carrots & Apples', b: 'Eat Only Fresh Campfire Pork', ra: [BlockId.APPLE, 4], rb: [BlockId.COOKED_PORK, 2] },
  { chapter: 'Wild Food & Potions', a: 'Glowing Sight Potion Forever', b: 'Super Strength Potion Forever', ra: [BlockId.GLOWSTONE, 2], rb: [BlockId.IRON_SWORD, 1] },
  { chapter: 'Wild Food & Potions', a: 'Pocket Bakery Crafting Table', b: 'Pocket Furnace on your Back', ra: [BlockId.CRAFTING_TABLE, 1], rb: [BlockId.FURNACE, 1] },
  { chapter: 'Wild Food & Potions', a: 'Golden Carrot Vision', b: 'Golden Apple Shield Aura', ra: [BlockId.GOLD_INGOT, 2], rb: [BlockId.GOLDEN_APPLE, 1] },

  // 51-60: Building & Traps
  { chapter: 'Building & Traps', a: 'Infinite TNT for Mining', b: 'Infinite Pistons & Bricks', ra: [BlockId.TNT, 3], rb: [BlockId.BRICK, 6] },
  { chapter: 'Building & Traps', a: 'Secret Trapdoor Mansion', b: 'Glass Pyramid in the Desert', ra: [BlockId.OAK_LOG, 4], rb: [BlockId.SANDSTONE, 6] },
  { chapter: 'Building & Traps', a: 'Build a Giant Pixel Statue', b: 'Build a Rollercoaster Network', ra: [BlockId.WOOL, 6], rb: [BlockId.IRON_INGOT, 4] },
  { chapter: 'Building & Traps', a: 'Instant Copy-Paste Houses', b: 'Instant Terrain Flatten Wand', ra: [BlockId.BRICK, 4], rb: [BlockId.STONE_SHOVEL, 1] },
  { chapter: 'Building & Traps', a: 'Bookshelf Secret Door', b: 'Waterfall Secret Cave Entrance', ra: [BlockId.BOOKSHELF, 2], rb: [BlockId.MOSSY_COBBLESTONE, 4] },
  { chapter: 'Building & Traps', a: 'Glowstone Streetlights Everywhere', b: 'Crystal Lanterns Everywhere', ra: [BlockId.GLOWSTONE, 2], rb: [BlockId.CRYSTAL_CLUSTER, 2] },
  { chapter: 'Building & Traps', a: 'Live in a Modern Emerald Villa', b: 'Live in a Medieval Stone Castle', ra: [BlockId.EMERALD_BLOCK, 1], rb: [BlockId.MOSSY_COBBLESTONE, 4] },
  { chapter: 'Building & Traps', a: 'TNT bounces before exploding', b: 'TNT turns Dirt into Gold', ra: [BlockId.TNT, 2], rb: [BlockId.GOLD_ORE, 2] },
  { chapter: 'Building & Traps', a: 'Unlimited Creative Blocks', b: 'Master Survival Crafter Skills', ra: [BlockId.QUARTZ_ORE, 2], rb: [BlockId.CRAFTING_TABLE, 1] },
  { chapter: 'Building & Traps', a: '100-Room Labyrinth Base', b: 'Floating Emerald City', ra: [BlockId.DEEPSLATE, 4], rb: [BlockId.EMERALD, 3] },

  // 61-70: Nether & Volcanoes
  { chapter: 'Nether & Volcanoes', a: 'Swim safely in Lava forever', b: 'Fly safely over the Nether', ra: [BlockId.NETHERRACK, 4], rb: [BlockId.FEATHER, 4] },
  { chapter: 'Nether & Volcanoes', a: 'Build your Base in the Nether', b: 'Put a Nether Portal in Bedroom', ra: [BlockId.NETHER_BRICKS, 4], rb: [BlockId.OBSIDIAN, 2] },
  { chapter: 'Nether & Volcanoes', a: 'Mine Quartz for 1 Hour', b: 'Explore a Nether Fortress Bridge', ra: [BlockId.NETHER_QUARTZ, 4], rb: [BlockId.NETHER_BRICKS, 4] },
  { chapter: 'Nether & Volcanoes', a: 'Flint and Steel shoots Fireballs', b: 'Sword sets Blocks on Glow-Fire', ra: [BlockId.FLINT_AND_STEEL, 1], rb: [BlockId.GOLD_SWORD, 1] },
  { chapter: 'Nether & Volcanoes', a: 'Soul Sand gives Speed Boost', b: 'Glowstone heals you nearby', ra: [BlockId.SOUL_SAND, 4], rb: [BlockId.GLOWSTONE, 2] },
  { chapter: 'Nether & Volcanoes', a: 'Live inside an Active Volcano', b: 'Live on a Frozen Glacier', ra: [BlockId.NETHERRACK, 4], rb: [BlockId.SNOW, 4] },
  { chapter: 'Nether & Volcanoes', a: 'Lava Lamp Mansion', b: 'Glowing Obsidian Temple', ra: [BlockId.GLASS, 4], rb: [BlockId.OBSIDIAN, 2] },
  { chapter: 'Nether & Volcanoes', a: 'Trade Gold for Nether Treasures', b: 'Trade Quartz for Diamond Gear', ra: [BlockId.GOLD_INGOT, 2], rb: [BlockId.NETHER_QUARTZ, 3] },
  { chapter: 'Nether & Volcanoes', a: 'Immune to Fire & Explosions', b: 'Immune to Arrows & Poison', ra: [BlockId.GOLD_CHESTPLATE, 1], rb: [BlockId.IRON_HELMET, 1] },
  { chapter: 'Nether & Volcanoes', a: 'Rule the Nether Kingdom', b: 'Rule the Overworld Kingdom', ra: [BlockId.NETHER_BRICKS, 4], rb: [BlockId.GRASS, 4] },

  // 71-80: Superpowers
  { chapter: 'Superpowers', a: 'Teleport wherever you Look', b: 'Pause Time for 10 Seconds', ra: [BlockId.CRYSTAL_CLUSTER, 2], rb: [BlockId.GOLD_BLOCK, 1] },
  { chapter: 'Superpowers', a: 'Turn Wood into Iron with a Touch', b: 'Turn Stone into Diamond 1x/Day', ra: [BlockId.IRON_INGOT, 3], rb: [BlockId.DIAMOND, 1] },
  { chapter: 'Superpowers', a: 'Become Invisible while Sneaking', b: 'Glow like a Beacon on Command', ra: [BlockId.GLASS, 4], rb: [BlockId.GLOWSTONE, 2] },
  { chapter: 'Superpowers', a: 'Summon Lightning with Sword', b: 'Summon Rainstorms when Dancing', ra: [BlockId.DIAMOND_SWORD, 1], rb: [BlockId.CAVE_MOSS, 3] },
  { chapter: 'Superpowers', a: 'Magnet pulls all Drops to you', b: 'Auto-Craft items in Pocket', ra: [BlockId.IRON_BLOCK, 1], rb: [BlockId.CRAFTING_TABLE, 1] },
  { chapter: 'Superpowers', a: 'Talk to Animals in your World', b: 'Command Skeleton Armies', ra: [BlockId.APPLE, 3], rb: [BlockId.BONE, 3] },
  { chapter: 'Superpowers', a: 'Walk through Walls like a Ghost', b: 'Lift Entire Mountains in Inventory', ra: [BlockId.SOUL_SAND, 3], rb: [BlockId.STONE, 8] },
  { chapter: 'Superpowers', a: 'Infinite Bow Arrows with Aim', b: 'Boomerang Diamond Pickaxe', ra: [BlockId.FEATHER, 4], rb: [BlockId.DIAMOND_PICKAXE, 1] },
  { chapter: 'Superpowers', a: 'Run on Water like Solid Ground', b: 'Bounce on Leaves like Trampolines', ra: [BlockId.CLAY, 4], rb: [BlockId.LEAVES, 4] },
  { chapter: 'Superpowers', a: 'Never get Lost (Permanent Compass)', b: 'Set 10 Teleport Home Waypoints', ra: [BlockId.EMERALD, 2], rb: [BlockId.TORCH, 6] },

  // 81-90: Boss & Arena
  { chapter: 'Boss & Arena', a: '1v1 a Mega Zombie Boss', b: 'Survive 5 Waves of Spiders', ra: [BlockId.IRON_SWORD, 1], rb: [BlockId.STRING, 4] },
  { chapter: 'Boss & Arena', a: 'Fight in an Open Sky Arena', b: 'Fight inside a Crystal Cave', ra: [BlockId.WOOL, 4], rb: [BlockId.CRYSTAL_CLUSTER, 2] },
  { chapter: 'Boss & Arena', a: 'Duo Boss Raid with Player 2', b: 'Solo Speedrun for Glory', ra: [BlockId.GOLDEN_APPLE, 1], rb: [BlockId.DIAMOND_SWORD, 1] },
  { chapter: 'Boss & Arena', a: 'Full Diamond Armor, Wooden Sword', b: 'No Armor, Ultra Diamond Sword', ra: [BlockId.DIAMOND_CHESTPLATE, 1], rb: [BlockId.DIAMOND_SWORD, 1] },
  { chapter: 'Boss & Arena', a: 'Trap Bosses with Pistons & TNT', b: 'Outrun Bosses with Speed Jumps', ra: [BlockId.TNT, 3], rb: [BlockId.FEATHER, 4] },
  { chapter: 'Boss & Arena', a: 'Defend a Village from Night Raid', b: 'Raid a Giant Monster Fortress', ra: [BlockId.EMERALD, 3], rb: [BlockId.NETHER_BRICKS, 4] },
  { chapter: 'Boss & Arena', a: 'Shield reflects Skeleton Arrows', b: 'Helmet makes Stalkers run away', ra: [BlockId.IRON_BLOCK, 1], rb: [BlockId.DIAMOND_HELMET, 1] },
  { chapter: 'Boss & Arena', a: 'Win 1,000,000 MineDollars', b: 'Unlock Every Marketplace Pack', ra: [BlockId.GOLD_BLOCK, 1], rb: [BlockId.EMERALD_BLOCK, 1] },
  { chapter: 'Boss & Arena', a: 'Host a 20-Player Build Contest', b: 'Host a 20-Player PvP Tournament', ra: [BlockId.OAK_PLANKS, 6], rb: [BlockId.DIAMOND_AXE, 1] },
  { chapter: 'Boss & Arena', a: 'Wear Crown of Emerald Champions', b: 'Wield Scepter of Diamond Fire', ra: [BlockId.EMERALD_BLOCK, 1], rb: [BlockId.DIAMOND_BLOCK, 1] },

  // 91-100: Legend Endgame
  { chapter: 'Legend Endgame', a: 'Reset World with All Skills', b: 'Keep Old Base Forever', ra: [BlockId.GRASS, 4], rb: [BlockId.BRICK, 4] },
  { chapter: 'Legend Endgame', a: '100-Block Statue of Yourself', b: '100-Block Pyramid of Diamond', ra: [BlockId.GOLD_BLOCK, 1], rb: [BlockId.DIAMOND_BLOCK, 1] },
  { chapter: 'Legend Endgame', a: 'Play Creative Forever', b: 'Play Hardcore Survival Forever', ra: [BlockId.GLOWSTONE, 2], rb: [BlockId.IRON_SWORD, 1] },
  { chapter: 'Legend Endgame', a: 'Master Every Parkour Course', b: 'Master Every Survival Challenge', ra: [BlockId.EMERALD, 3], rb: [BlockId.DIAMOND, 2] },
  { chapter: 'Legend Endgame', a: 'Skyblock Wizard Tower', b: 'One Block Infinite Empire', ra: [BlockId.CRYSTAL_CLUSTER, 2], rb: [BlockId.GRASS, 4] },
  { chapter: 'Legend Endgame', a: 'Play Co-op with Friends Daily', b: 'Build Solo Masterpiece Worlds', ra: [BlockId.TORCH, 4], rb: [BlockId.BOOKSHELF, 2] },
  { chapter: 'Legend Endgame', a: 'Find Secret Easter Eggs in Maps', b: 'Design Your Own Custom Maps', ra: [BlockId.EMERALD, 2], rb: [BlockId.CRAFTING_TABLE, 1] },
  { chapter: 'Legend Endgame', a: 'Rain of Diamonds for 1 Minute', b: 'Rain of Golden Apples forever', ra: [BlockId.DIAMOND, 3], rb: [BlockId.GOLDEN_APPLE, 2] },
  { chapter: 'Legend Endgame', a: 'Become Voxel World Architect', b: 'Become Voxel Arena Champion', ra: [BlockId.DIAMOND_PICKAXE, 1], rb: [BlockId.DIAMOND_SWORD, 1] },
  { chapter: 'Legend Endgame', a: 'Claim Emerald Champion Crown!', b: 'Claim Diamond Legend Crown!', ra: [BlockId.EMERALD_BLOCK, 2], rb: [BlockId.DIAMOND_BLOCK, 2] },
];

const CHAPTER_THEMES: { trim: BlockId; matA: BlockId; matB: BlockId }[] = [
  { trim: BlockId.OAK_PLANKS, matA: BlockId.EMERALD_BLOCK, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.COBBLESTONE, matA: BlockId.CAVE_MOSS, matB: BlockId.BRICK },
  { trim: BlockId.STONE, matA: BlockId.EMERALD_BLOCK, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.SNOW, matA: BlockId.EMERALD_BLOCK, matB: BlockId.DIAMOND_BLOCK },
  { trim: BlockId.SANDSTONE, matA: BlockId.CAVE_MOSS, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.BRICK, matA: BlockId.CRYSTAL_CLUSTER, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.NETHER_BRICKS, matA: BlockId.EMERALD_BLOCK, matB: BlockId.NETHER_BRICKS },
  { trim: BlockId.DEEPSLATE, matA: BlockId.CRYSTAL_CLUSTER, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.OBSIDIAN, matA: BlockId.EMERALD_BLOCK, matB: BlockId.GOLD_BLOCK },
  { trim: BlockId.DIAMOND_BLOCK, matA: BlockId.EMERALD_BLOCK, matB: BlockId.DIAMOND_BLOCK },
];

function buildWouldYouRather100(): WouldYouRatherLevel[] {
  const levels: WouldYouRatherLevel[] = [];

  // Level 0: Start Plaza around z = -2..2
  levels.push({
    level: 0,
    chapter: 'Start Hall',
    optionA: 'Walk Ahead to Start!',
    optionB: 'Step onto A (Left) or B (Right)!',
    y: 31,
    entryZ1: 2,
    entryZ0: -2,
    forkZ1: 2,
    forkZ0: -2,
    exitZ1: -2,
    exitZ0: -2,
    matA: BlockId.EMERALD_BLOCK,
    matB: BlockId.GOLD_BLOCK,
    trimMat: BlockId.OAK_PLANKS,
    isMilestone: true,
  });

  // 100 dilemma stages walking north (-Z)
  // Each stage is 8 blocks deep so 100 stages run from z = -3 to z = -802
  for (let i = 0; i < 100; i++) {
    const lvl = i + 1;
    const q = QUESTIONS[i];
    const chapterIdx = Math.min(9, Math.floor(i / 10));
    const theme = CHAPTER_THEMES[chapterIdx];

    // Gentle climb across the 100-level hall (steps up +1 every 6 levels: 31 -> 47)
    const y = 31 + Math.floor(i / 6);

    const entryZ1 = -3 - i * 8;
    const entryZ0 = entryZ1 - 1;
    const forkZ1 = entryZ1 - 2;
    const forkZ0 = entryZ1 - 5;
    const exitZ1 = entryZ1 - 6;
    const exitZ0 = entryZ1 - 7;

    levels.push({
      level: lvl,
      chapter: q.chapter,
      optionA: q.a,
      optionB: q.b,
      rewardA: q.ra ? { id: q.ra[0], count: q.ra[1] } : undefined,
      rewardB: q.rb ? { id: q.rb[0], count: q.rb[1] } : undefined,
      y,
      entryZ1,
      entryZ0,
      forkZ1,
      forkZ0,
      exitZ1,
      exitZ0,
      matA: theme.matA,
      matB: theme.matB,
      trimMat: theme.trim,
      isMilestone: lvl % 10 === 0,
    });
  }

  return levels;
}

export const WOULD_YOU_RATHER_LEVELS: WouldYouRatherLevel[] = buildWouldYouRather100();
export const WYR_FINISH_Y = WOULD_YOU_RATHER_LEVELS[WOULD_YOU_RATHER_LEVELS.length - 1].y;
export const WYR_FINISH_Z1 = WOULD_YOU_RATHER_LEVELS[WOULD_YOU_RATHER_LEVELS.length - 1].exitZ0 - 1;
export const WYR_FINISH_Z0 = WYR_FINISH_Z1 - 6;
