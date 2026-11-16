import { BlockId, BLOCK_DEFS, InventorySlot as EngineInventorySlot } from './types';

export interface InventoryItem {
  id: string;
  name: string;
  icon: string; // Emoji or texture path
  count: number;
  maxStack: number;
}

export type InventorySlot = InventoryItem | null;

export const HOTBAR_SIZE = 9;
export const MAIN_INVENTORY_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + MAIN_INVENTORY_SIZE; // 36 slots (0-8 = Hotbar, 9-35 = Main)

export function createEmptyInventory(): InventorySlot[] {
  return Array(TOTAL_SLOTS).fill(null);
}

/**
 * Adds an item to the inventory, filling existing stacks first, then empty slots.
 * Returns the leftover item count if the inventory is full.
 */
export function addItemToInventory(
  slots: InventorySlot[],
  newItem: InventoryItem
): { updatedSlots: InventorySlot[]; remaining: number } {
  const nextSlots = [...slots];
  let remaining = newItem.count;

  // 1. Try to stack onto existing matching slots
  for (let i = 0; i < nextSlots.length && remaining > 0; i++) {
    const slot = nextSlots[i];
    if (slot && slot.id === newItem.id && slot.count < slot.maxStack) {
      const space = slot.maxStack - slot.count;
      const toAdd = Math.min(space, remaining);
      nextSlots[i] = { ...slot, count: slot.count + toAdd };
      remaining -= toAdd;
    }
  }

  // 2. Place remaining items into empty slots
  for (let i = 0; i < nextSlots.length && remaining > 0; i++) {
    if (nextSlots[i] === null) {
      const toAdd = Math.min(newItem.maxStack, remaining);
      nextSlots[i] = { ...newItem, count: toAdd };
      remaining -= toAdd;
    }
  }

  return { updatedSlots: nextSlots, remaining };
}

// Engine adapter helpers connecting VoxelGameEngine's compact saved slots with the structured inventory utilities
export function createEmptyBlockInventory(): (EngineInventorySlot | null)[] {
  return createEmptyInventory().map(() => null);
}

export function addBlockToEngineInventory(
  slots: (EngineInventorySlot | null)[],
  blockId: BlockId,
  count: number,
  getIcon?: (id: BlockId) => string
): { updatedSlots: (EngineInventorySlot | null)[]; remaining: number } {
  const def = BLOCK_DEFS[blockId];
  const maxStack = def?.stackMax ?? 64;

  const normalized: InventorySlot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const s = slots[i];
    if (!s) return null;
    const sDef = BLOCK_DEFS[s.id];
    return {
      id: String(s.id),
      name: sDef?.name ?? `Item ${s.id}`,
      icon: getIcon ? getIcon(s.id) : '',
      count: s.count,
      maxStack: sDef?.stackMax ?? 64,
    };
  });

  const { updatedSlots, remaining } = addItemToInventory(normalized, {
    id: String(blockId),
    name: def?.name ?? `Item ${blockId}`,
    icon: getIcon ? getIcon(blockId) : '',
    count,
    maxStack,
  });

  const engineSlots: (EngineInventorySlot | null)[] = updatedSlots.map((item) =>
    item ? { id: Number(item.id) as BlockId, count: item.count } : null
  );

  return { updatedSlots: engineSlots, remaining };
}
