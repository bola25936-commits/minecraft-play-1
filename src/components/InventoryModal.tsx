import React, { useEffect, useState } from 'react';
import { Archive, Backpack, Flame, Hammer, Shield, Sparkles, X } from 'lucide-react';
import {
  canCraftFromInventory,
  canSmeltFromInventory,
  CRAFT_RECIPES,
  CraftingRecipe,
  getRecipeIngredients,
  SMELT_RECIPES,
} from '../game/crafting';
import { HOTBAR_SIZE, MAIN_INVENTORY_SIZE } from '../game/inventory';
import { ARMOR_SLOT_KEYS, ArmorSlotKey, BlockId, BLOCK_DEFS, HudSnapshot } from '../game/types';

type SlotRef =
  | { container: 'player' | 'chest'; index: number }
  | { container: 'armor'; slotKey: ArmorSlotKey };

const ARMOR_LABELS: Record<ArmorSlotKey, string> = {
  helmet: 'Helmet',
  chestplate: 'Chest',
  leggings: 'Legs',
  boots: 'Boots',
};

interface InventoryModalProps {
  hud: HudSnapshot;
  getIcon: (id: BlockId) => string;
  onClose: () => void;
  onTransferSlot: (
    fromContainer: 'player' | 'chest',
    fromIdx: number,
    toContainer: 'player' | 'chest',
    toIdx: number
  ) => void;
  onQuickTransferSlot: (container: 'player' | 'chest', idx: number) => void;
  onInteractArmorSlot: (
    slotKey: ArmorSlotKey,
    container?: 'player' | 'chest',
    idx?: number
  ) => void;
  onQuickEquipArmor: (container: 'player' | 'chest', idx: number) => boolean;
  onCraftRecipe: (recipe: CraftingRecipe) => boolean;
  onGiveCreative: (id: BlockId) => void;
}

const ALL_BLOCK_IDS: BlockId[] = Object.values(BLOCK_DEFS)
  .filter((d) => d.id !== BlockId.AIR)
  .map((d) => d.id);

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  getIcon,
  onClose,
  onTransferSlot,
  onQuickTransferSlot,
  onInteractArmorSlot,
  onQuickEquipArmor,
  onCraftRecipe,
  onGiveCreative,
}) => {
  const station = hud.activeStation;
  const gridSize = station === 'crafting_table' ? 3 : 2;
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [tab, setTab] = useState<'craft' | 'creative'>(
    hud.mode === 'creative' && station === 'inventory' ? 'creative' : 'craft'
  );

  useEffect(() => {
    setSelectedSlot(null);
    if (station !== 'inventory') {
      setTab('craft');
    }
  }, [station]);

  const handleSlotClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    container: 'player' | 'chest',
    idx: number
  ) => {
    const list = container === 'chest' ? hud.chestSlots : hud.inventory;
    if (e.shiftKey && list[idx]) {
      if (station === 'chest') {
        onQuickTransferSlot(container, idx);
        setSelectedSlot(null);
        return;
      }
      if (onQuickEquipArmor(container, idx)) {
        setSelectedSlot(null);
        return;
      }
    }

    if (selectedSlot === null) {
      if (list[idx]) {
        setSelectedSlot({ container, index: idx });
      }
      return;
    }

    if (selectedSlot.container === 'armor') {
      onInteractArmorSlot(selectedSlot.slotKey, container, idx);
      setSelectedSlot(null);
      return;
    }

    onTransferSlot(selectedSlot.container, selectedSlot.index, container, idx);
    setSelectedSlot(null);
  };

  const handleArmorClick = (e: React.MouseEvent<HTMLButtonElement>, slotKey: ArmorSlotKey) => {
    const worn = hud.armor[slotKey];
    if (e.shiftKey && worn) {
      onInteractArmorSlot(slotKey);
      setSelectedSlot(null);
      return;
    }

    if (selectedSlot === null) {
      if (worn) {
        setSelectedSlot({ container: 'armor', slotKey });
      }
      return;
    }

    if (selectedSlot.container === 'armor') {
      if (selectedSlot.slotKey === slotKey) {
        onInteractArmorSlot(slotKey);
      } else if (worn) {
        setSelectedSlot({ container: 'armor', slotKey });
        return;
      }
      setSelectedSlot(null);
      return;
    }

    onInteractArmorSlot(slotKey, selectedSlot.container, selectedSlot.index);
    setSelectedSlot(null);
  };

  const renderStationHeader = () => {
    if (station === 'crafting_table') {
      return (
        <>
          <Hammer className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-bold tracking-wide">Crafting Table (3×3)</h2>
            <p className="text-[11px] text-slate-400">Crafting Only — Tools, Armor, Blocks & Gear</p>
          </div>
        </>
      );
    }
    if (station === 'furnace') {
      return (
        <>
          <Flame className="h-5 w-5 text-orange-400" />
          <div>
            <h2 className="text-lg font-bold tracking-wide">Furnace</h2>
            <p className="text-[11px] text-slate-400">Smelting Only — Ores, Stone, Glass, Bricks & Food</p>
          </div>
        </>
      );
    }
    if (station === 'chest') {
      return (
        <>
          <Archive className="h-5 w-5 text-amber-300" />
          <div>
            <h2 className="text-lg font-bold tracking-wide">Storage Chest</h2>
            <p className="text-[11px] text-slate-400">
              Item Storage Only — 27 Persistent Chest Slots
            </p>
          </div>
        </>
      );
    }
    return (
      <>
        <Backpack className="h-5 w-5 text-emerald-400" />
        <div>
          <h2 className="text-lg font-bold tracking-wide">Inventory & Crafting</h2>
          <p className="text-[11px] text-slate-400">2×2 Hand Crafting & Armor</p>
        </div>
        {hud.mode === 'creative' && (
          <div className="ml-2 flex gap-1 rounded-none bg-[#0f1218] p-0.5">
            <button
              type="button"
              onClick={() => setTab('creative')}
              className={`flex items-center gap-1 rounded-none px-2.5 py-1 text-xs font-semibold ${
                tab === 'creative' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setTab('craft')}
              className={`rounded-none px-2.5 py-1 text-xs font-semibold ${
                tab === 'craft' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Recipes
            </button>
          </div>
        )}
      </>
    );
  };

  const chestUsedCount = hud.chestSlots.filter(Boolean).length;
  const armorBlockPct = Math.min(80, Math.round((hud.armorDefense / 20) * 80));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-none border-2 border-[#3c4352] bg-[#161a22] p-5 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">{renderStationHeader()}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border border-white/15 bg-[#222834] p-1.5 text-slate-300 hover:bg-[#2d3545] hover:text-white"
            aria-label="Close Station"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Left Column: Armor + Backpack + Hotbar */}
          <div className="flex flex-col gap-3.5 md:col-span-7">
            <div className="text-xs text-slate-400">
              {station === 'chest'
                ? 'Click an item, then click a slot to move/stack. Shift+Click quick-transfers.'
                : 'Click an item, then click a slot to move/equip. Shift+Click quick-equips armor.'}
            </div>

            {/* Equipped Armor Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-[#11151d] px-3 py-2">
              <div className="flex items-center gap-2">
                {ARMOR_SLOT_KEYS.map((slotKey) => {
                  const slot = hud.armor[slotKey];
                  const isSel = selectedSlot?.container === 'armor' && selectedSlot.slotKey === slotKey;
                  const defVal = slot ? BLOCK_DEFS[slot.id]?.armorDefense ?? 0 : 0;
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={(e) => handleArmorClick(e, slotKey)}
                      className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-none border-2 transition ${
                        isSel
                          ? 'border-cyan-400 bg-[#2a394a]'
                          : slot
                            ? 'border-cyan-500/45 bg-[#1b2430] hover:border-cyan-400'
                            : 'border-[#2b313d] bg-[#191e27] hover:border-slate-500'
                      }`}
                      title={
                        slot
                          ? `${BLOCK_DEFS[slot.id]?.name} (+${defVal} Armor) — Click again or Shift+Click to unequip`
                          : `${ARMOR_LABELS[slotKey]} Armor Slot`
                      }
                    >
                      {slot ? (
                        <img
                          src={getIcon(slot.id)}
                          alt={BLOCK_DEFS[slot.id]?.name}
                          className="pixelated h-7 w-7"
                        />
                      ) : (
                        <span className="text-[9px] font-semibold uppercase tracking-tight text-slate-500">
                          {ARMOR_LABELS[slotKey]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-right">
                <Shield className="h-4 w-4 text-cyan-300" />
                <div>
                  <div className="tabular-nums text-xs font-bold text-cyan-200">
                    Armor {hud.armorDefense} / 20
                  </div>
                  <div className="tabular-nums text-[10px] text-slate-400">
                    {armorBlockPct}% Damage Reduction
                  </div>
                </div>
              </div>
            </div>

            {/* Backpack (slots 9..35) */}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Backpack
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: MAIN_INVENTORY_SIZE }).map((_, i) => {
                  const idx = i + HOTBAR_SIZE;
                  const slot = hud.inventory[idx];
                  const isSel = selectedSlot?.container === 'player' && selectedSlot.index === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => handleSlotClick(e, 'player', idx)}
                      className={`relative flex h-11 w-full items-center justify-center rounded-none border-2 transition ${
                        isSel
                          ? 'border-amber-400 bg-[#374151]'
                          : 'border-[#2b313d] bg-[#20252e] hover:border-slate-500'
                      }`}
                      title={slot ? BLOCK_DEFS[slot.id]?.name : 'Empty Slot'}
                    >
                      {slot && (
                        <>
                          <img
                            src={getIcon(slot.id)}
                            alt={BLOCK_DEFS[slot.id]?.name}
                            className="pixelated h-7 w-7"
                          />
                          {slot.count > 1 && (
                            <span className="tabular-nums absolute bottom-0 right-1 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_#000]">
                              {slot.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hotbar (slots 0..8) */}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Hotbar
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {Array.from({ length: HOTBAR_SIZE }).map((_, idx) => {
                  const slot = hud.inventory[idx];
                  const isSel = selectedSlot?.container === 'player' && selectedSlot.index === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => handleSlotClick(e, 'player', idx)}
                      className={`relative flex h-11 w-full items-center justify-center rounded-none border-2 transition ${
                        isSel
                          ? 'border-amber-400 bg-[#374151]'
                          : 'border-[#3b4252] bg-[#252b36] hover:border-slate-400'
                      }`}
                      title={slot ? BLOCK_DEFS[slot.id]?.name : `Hotbar ${idx + 1}`}
                    >
                      {slot && (
                        <>
                          <img
                            src={getIcon(slot.id)}
                            alt={BLOCK_DEFS[slot.id]?.name}
                            className="pixelated h-7 w-7"
                          />
                          {slot.count > 1 && (
                            <span className="tabular-nums absolute bottom-0 right-1 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_#000]">
                              {slot.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Station-Specific Panel */}
          <div className="flex flex-col gap-2 rounded-none border border-white/10 bg-[#11141b] p-3 md:col-span-5">
            {station === 'chest' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Chest Storage
                  </span>
                  <span className="tabular-nums text-[11px] text-slate-400">
                    {chestUsedCount} / 27 slots
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Store blocks, tools & resources inside this chest.
                </div>
                <div className="mt-1 grid grid-cols-9 gap-1">
                  {Array.from({ length: 27 }).map((_, idx) => {
                    const slot = hud.chestSlots[idx] ?? null;
                    const isSel = selectedSlot?.container === 'chest' && selectedSlot.index === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => handleSlotClick(e, 'chest', idx)}
                        className={`relative flex h-10 w-full items-center justify-center rounded-none border-2 transition ${
                          isSel
                            ? 'border-amber-400 bg-[#374151]'
                            : 'border-[#3a2f24] bg-[#211b15] hover:border-amber-500/70'
                        }`}
                        title={slot ? BLOCK_DEFS[slot.id]?.name : `Chest Slot ${idx + 1}`}
                      >
                        {slot && (
                          <>
                            <img
                              src={getIcon(slot.id)}
                              alt={BLOCK_DEFS[slot.id]?.name}
                              className="pixelated h-6 w-6"
                            />
                            {slot.count > 1 && (
                              <span className="tabular-nums absolute bottom-0 right-0.5 text-[9px] font-bold text-white drop-shadow-[0_1px_1px_#000]">
                                {slot.count}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-auto border-t border-white/10 pt-2 text-[11px] text-slate-400">
                  Tip: Mining or blasting a chest drops all stored items onto the ground.
                </div>
              </>
            ) : station === 'furnace' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">
                    Smelting Recipes
                  </span>
                  <span className="text-[10px] text-orange-200/75">
                    Coal Fuel Required
                  </span>
                </div>
                <div className="flex items-center justify-between border border-orange-500/20 bg-orange-950/20 px-2.5 py-1.5 text-[11px] text-orange-200/90">
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    Input + Coal
                  </span>
                  <span>→</span>
                  <span className="font-semibold text-amber-300">Smelted Item</span>
                </div>
                <div className="mt-1 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                  {SMELT_RECIPES.map((recipe) => {
                    const smeltable = canSmeltFromInventory(recipe, hud.inventory);
                    const ingredients = getRecipeIngredients(recipe);

                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        disabled={!smeltable}
                        onClick={() => onCraftRecipe(recipe)}
                        className={`flex items-center justify-between rounded-none border px-2.5 py-2 text-left transition ${
                          smeltable
                            ? 'border-orange-500/45 bg-[#261a14] hover:border-orange-400 hover:bg-[#332118]'
                            : 'border-white/5 bg-[#181c24] opacity-55 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getIcon(recipe.output.id)}
                            alt={recipe.name}
                            className="pixelated h-7 w-7"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {recipe.name}{' '}
                              {recipe.output.count > 1 && (
                                <span className="text-amber-300">×{recipe.output.count}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                              {ingredients.map((ing) => (
                                <span key={ing.id} className="inline-flex items-center gap-0.5">
                                  <img src={getIcon(ing.id)} alt="" className="pixelated h-3.5 w-3.5" />
                                  {ing.count} {BLOCK_DEFS[ing.id]?.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-none px-2 py-0.5 text-[10px] font-bold uppercase ${
                            smeltable
                              ? 'bg-orange-500 text-slate-950'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {smeltable ? 'Smelt' : 'Need'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : station === 'inventory' && tab === 'creative' && hud.mode === 'creative' ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Creative Block & Tool Catalog
                </div>
                <div className="text-[11px] text-slate-400">
                  Click any item to equip a full stack in your active hotbar slot.
                </div>
                <div className="mt-1 grid max-h-72 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
                  {ALL_BLOCK_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onGiveCreative(id)}
                      className="flex flex-col items-center justify-center gap-1 rounded-none border border-[#2a303d] bg-[#1c212b] p-1.5 text-center hover:border-amber-400 hover:bg-[#262d3b]"
                      title={BLOCK_DEFS[id].name}
                    >
                      <img src={getIcon(id)} alt={BLOCK_DEFS[id].name} className="pixelated h-7 w-7" />
                      <span className="w-full truncate text-[9px] text-slate-300">
                        {BLOCK_DEFS[id].name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Crafting Recipes
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {gridSize === 3 ? '3×3 Table Active' : 'RMB Crafting Table for 3×3'}
                  </span>
                </div>
                <div className="mt-1 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                  {CRAFT_RECIPES.map((recipe) => {
                    const craftable = canCraftFromInventory(recipe, hud.inventory, gridSize);
                    const needsTable = recipe.requiresTable && gridSize < 3;
                    const ingredients = getRecipeIngredients(recipe);

                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        disabled={!craftable}
                        onClick={() => onCraftRecipe(recipe)}
                        className={`flex items-center justify-between rounded-none border px-2.5 py-2 text-left transition ${
                          craftable
                            ? 'border-emerald-500/40 bg-[#1a2621] hover:border-emerald-400 hover:bg-[#22332c]'
                            : 'border-white/5 bg-[#181c24] opacity-55 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getIcon(recipe.output.id)}
                            alt={recipe.name}
                            className="pixelated h-7 w-7"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {recipe.name}{' '}
                              {recipe.output.count > 1 && (
                                <span className="text-amber-300">×{recipe.output.count}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                              {ingredients.map((ing) => (
                                <span key={ing.id} className="inline-flex items-center gap-0.5">
                                  <img src={getIcon(ing.id)} alt="" className="pixelated h-3.5 w-3.5" />
                                  {ing.count} {BLOCK_DEFS[ing.id]?.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-none px-2 py-0.5 text-[10px] font-bold uppercase ${
                            craftable
                              ? 'bg-emerald-500 text-slate-950'
                              : needsTable
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {craftable ? 'Craft' : needsTable ? '3×3' : 'Need'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
