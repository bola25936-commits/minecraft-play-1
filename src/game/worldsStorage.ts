import { SavedWorldData } from './types';

const STORAGE_KEY = 'voxelcraft_saved_worlds_v1';
const ACTIVE_ID_KEY = 'voxelcraft_active_world_id_v1';

export function loadSavedWorlds(): SavedWorldData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w): w is SavedWorldData => !!w && typeof w.id === 'string' && typeof w.seed === 'string')
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  } catch {
    return [];
  }
}

export function getActiveWorldId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorldId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {
    // Ignore storage quota errors
  }
}

export function upsertSavedWorld(save: SavedWorldData): SavedWorldData[] {
  const existing = loadSavedWorlds();
  const idx = existing.findIndex((w) => w.id === save.id);
  const next = [...existing];
  if (idx >= 0) {
    next[idx] = save;
  } else {
    next.unshift(save);
  }
  next.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(ACTIVE_ID_KEY, save.id);
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function deleteSavedWorld(id: string): SavedWorldData[] {
  const next = loadSavedWorlds().filter((w) => w.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (localStorage.getItem(ACTIVE_ID_KEY) === id) {
      if (next[0]) localStorage.setItem(ACTIVE_ID_KEY, next[0].id);
      else localStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function renameSavedWorld(id: string, newName: string): SavedWorldData[] {
  const trimmed = newName.trim();
  if (!trimmed) return loadSavedWorlds();
  const next = loadSavedWorlds().map((w) => (w.id === id ? { ...w, name: trimmed } : w));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function createWorldId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
