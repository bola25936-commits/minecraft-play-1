import { PlayerSkin } from './skins';
import { BlockId, GameMode, InventorySlot, WorldType } from './types';

export interface RemotePlayerState {
  id: string;
  name: string;
  skin: PlayerSkin | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  heldItem: BlockId | null;
  isMoving: boolean;
  voiceEnabled?: boolean;
  voiceMuted?: boolean;
  isSpeaking?: boolean;
}

export interface RoomSummary {
  id: string;
  name: string;
  seed: string;
  worldType: WorldType;
  mode: GameMode;
  playerCount: number;
  lastActiveAt: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  seed: string;
  worldType: WorldType;
  mode: GameMode;
  timeOfDay: number;
  dayCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
  system?: boolean;
}

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting';

export interface JoinRoomOptions {
  roomId: string;
  playerName: string;
  skin: PlayerSkin;
  create?: {
    name: string;
    seed: string;
    worldType: WorldType;
    mode: GameMode;
    modifiedBlocks?: [string, BlockId][];
    chests?: Record<string, (InventorySlot | null)[]>;
  };
}

export interface MultiplayerCallbacks {
  onStatusChange: (status: ConnectionStatus, room: RoomInfo | null, youId: string | null) => void;
  onRoomState: (payload: {
    youId: string;
    room: RoomInfo;
    modifiedBlocks: [string, BlockId][];
    chests: Record<string, (InventorySlot | null)[]>;
    players: RemotePlayerState[];
    chatHistory: ChatMessage[];
  }) => void;
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (data: {
    playerId: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    heldItem: BlockId | null;
    isMoving: boolean;
  }) => void;
  onPlayerSwung: (playerId: string) => void;
  onPlayerSkinned: (playerId: string, skin: PlayerSkin | null) => void;
  onBlockSet: (wx: number, wy: number, wz: number, blockId: BlockId) => void;
  onChestUpdated: (key: string, slots: (InventorySlot | null)[]) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onPlayerVoice?: (data: {
    playerId: string;
    voiceEnabled: boolean;
    voiceMuted: boolean;
    isSpeaking: boolean;
  }) => void;
  onRtcSignal?: (fromId: string, signal: unknown) => void;
}

const PLAYER_NAME_KEY = 'voxelcraft_player_name_v1';

export function loadPlayerName(): string {
  try {
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 20);
  } catch {
    // Ignore
  }
  const suffix = Math.floor(100 + Math.random() * 900);
  const generated = `Player${suffix}`;
  savePlayerName(generated);
  return generated;
}

export function savePlayerName(name: string): void {
  try {
    const clean = name.trim().slice(0, 20);
    if (clean) localStorage.setItem(PLAYER_NAME_KEY, clean);
  } catch {
    // Ignore
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function fetchActiveRooms(): Promise<RoomSummary[]> {
  try {
    const res = await fetch('/api/rooms');
    if (!res.ok) return [];
    const data = (await res.json()) as { rooms?: RoomSummary[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  } catch {
    return [];
  }
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerCallbacks;
  private status: ConnectionStatus = 'offline';
  private activeOptions: JoinRoomOptions | null = null;
  private currentRoom: RoomInfo | null = null;
  private youId: string | null = null;
  private intentionalClose = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private lastMoveSentAt = 0;
  private pendingQueue: string[] = [];

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getRoom(): RoomInfo | null {
    return this.currentRoom;
  }

  public connectAndJoin(options: JoinRoomOptions) {
    this.clearReconnect();
    this.intentionalClose = false;
    this.activeOptions = options;
    this.reconnectAttempt = 0;
    this.openSocket(false);
  }

  private openSocket(isReconnect: boolean) {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    const opts = this.activeOptions;
    if (!opts) return;

    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempt = 0;
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomId: opts.roomId,
          playerName: opts.playerName,
          skin: opts.skin,
          create: opts.create,
        })
      );
      while (this.pendingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const queued = this.pendingQueue.shift()!;
        ws.send(queued);
      }
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;
      if (type === 'room:state') {
        this.youId = String(msg.youId);
        this.currentRoom = msg.room as RoomInfo;
        this.setStatus('connected');
        this.callbacks.onRoomState({
          youId: this.youId,
          room: this.currentRoom,
          modifiedBlocks: (msg.modifiedBlocks as [string, BlockId][]) ?? [],
          chests: (msg.chests as Record<string, (InventorySlot | null)[]>) ?? {},
          players: (msg.players as RemotePlayerState[]) ?? [],
          chatHistory: (msg.chatHistory as ChatMessage[]) ?? [],
        });
      } else if (type === 'player:joined') {
        this.callbacks.onPlayerJoined(msg.player as RemotePlayerState);
      } else if (type === 'player:left') {
        this.callbacks.onPlayerLeft(String(msg.playerId));
      } else if (type === 'player:moved') {
        this.callbacks.onPlayerMoved({
          playerId: String(msg.playerId),
          x: Number(msg.x),
          y: Number(msg.y),
          z: Number(msg.z),
          yaw: Number(msg.yaw),
          pitch: Number(msg.pitch),
          heldItem: typeof msg.heldItem === 'number' ? (msg.heldItem as BlockId) : null,
          isMoving: Boolean(msg.isMoving),
        });
      } else if (type === 'player:swung') {
        this.callbacks.onPlayerSwung(String(msg.playerId));
      } else if (type === 'player:skinned') {
        this.callbacks.onPlayerSkinned(String(msg.playerId), (msg.skin as PlayerSkin | null) ?? null);
      } else if (type === 'block:set') {
        this.callbacks.onBlockSet(
          Number(msg.wx),
          Number(msg.wy),
          Number(msg.wz),
          Number(msg.blockId) as BlockId
        );
      } else if (type === 'chest:updated') {
        this.callbacks.onChestUpdated(
          String(msg.key),
          (msg.slots as (InventorySlot | null)[]) ?? []
        );
      } else if (type === 'chat:msg') {
        this.callbacks.onChatMessage(msg.msg as ChatMessage);
      } else if (type === 'player:voice') {
        this.callbacks.onPlayerVoice?.({
          playerId: String(msg.playerId),
          voiceEnabled: Boolean(msg.voiceEnabled),
          voiceMuted: Boolean(msg.voiceMuted),
          isSpeaking: Boolean(msg.isSpeaking),
        });
      } else if (type === 'rtc:signal') {
        this.callbacks.onRtcSignal?.(String(msg.fromId), msg.signal);
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.intentionalClose || !this.activeOptions) {
        this.currentRoom = null;
        this.youId = null;
        this.setStatus('offline');
        return;
      }
      this.setStatus('reconnecting');
      const delay = Math.min(3500, 600 * Math.pow(1.6, this.reconnectAttempt));
      this.reconnectAttempt++;
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.intentionalClose && this.activeOptions) {
          this.openSocket(true);
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose handles reconnect
    };
  }

  public disconnect() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.activeOptions = null;
    this.currentRoom = null;
    this.youId = null;
    this.pendingQueue = [];
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.setStatus('offline');
  }

  public sendMove(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    heldItem: BlockId | null,
    isMoving: boolean
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - this.lastMoveSentAt < 50) return;
    this.lastMoveSentAt = now;
    this.ws.send(
      JSON.stringify({
        type: 'player:move',
        x,
        y,
        z,
        yaw,
        pitch,
        heldItem,
        isMoving,
      })
    );
  }

  public sendSwing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'player:swing' }));
  }

  public sendSkinUpdate(skin: PlayerSkin) {
    if (this.activeOptions) {
      this.activeOptions.skin = skin;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'player:skin', skin }));
  }

  public sendBlockSet(wx: number, wy: number, wz: number, blockId: BlockId) {
    const payload = JSON.stringify({ type: 'block:set', wx, wy, wz, blockId });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else if (this.activeOptions && !this.intentionalClose) {
      this.pendingQueue.push(payload);
    }
  }

  public sendChestUpdate(key: string, slots: (InventorySlot | null)[]) {
    const payload = JSON.stringify({ type: 'chest:update', key, slots });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else if (this.activeOptions && !this.intentionalClose) {
      this.pendingQueue.push(payload);
    }
  }

  public sendChat(text: string) {
    const clean = text.trim().slice(0, 220);
    if (!clean || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'chat:send', text: clean }));
  }

  public sendVoiceState(voiceEnabled: boolean, voiceMuted: boolean, isSpeaking: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'voice:state', voiceEnabled, voiceMuted, isSpeaking }));
  }

  public sendRtcSignal(targetId: string, signal: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'rtc:signal', targetId, signal }));
  }

  private clearReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(next: ConnectionStatus) {
    this.status = next;
    this.callbacks.onStatusChange(next, this.currentRoom, this.youId);
  }
}
