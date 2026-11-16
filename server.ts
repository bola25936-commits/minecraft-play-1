import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WorldType = 'normal' | 'skyblock' | 'tutorial' | 'parkour' | 'parkour100' | 'oneblock' | 'wouldyourather';
type GameMode = 'survival' | 'creative' | 'hardcore';

interface InventorySlot {
  id: number;
  count: number;
}

interface PlayerSkinPayload {
  id: string;
  name: string;
  builtIn?: boolean;
  createdAt: number;
  head: string[];
  torso: string[];
  arm: string[];
  leg: string[];
}

interface RemotePlayerState {
  id: string;
  name: string;
  skin: PlayerSkinPayload | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  heldItem: number | null;
  isMoving: boolean;
  voiceEnabled?: boolean;
  voiceMuted?: boolean;
  isSpeaking?: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
  system?: boolean;
}

interface RoomState {
  id: string;
  name: string;
  seed: string;
  worldType: WorldType;
  mode: GameMode;
  timeOfDay: number;
  dayCount: number;
  modifiedBlocks: Map<string, number>;
  chests: Map<string, (InventorySlot | null)[]>;
  players: Map<string, { ws: WebSocket; state: RemotePlayerState }>;
  chatHistory: ChatMessage[];
  lastActiveAt: number;
}

const rooms = new Map<string, RoomState>();

function ensureDefaultPublicRoom(): RoomState {
  const existing = rooms.get('PUBLIC');
  if (existing) return existing;
  const room: RoomState = {
    id: 'PUBLIC',
    name: 'Public Emerald Server',
    seed: 'voxel-valley-2026',
    worldType: 'normal',
    mode: 'survival',
    timeOfDay: 0.055,
    dayCount: 1,
    modifiedBlocks: new Map(),
    chests: new Map(),
    players: new Map(),
    chatHistory: [
      {
        id: 'sys_welcome',
        senderId: 'server',
        senderName: 'Server',
        text: 'Welcome to Public Emerald Server! Press T to chat with players.',
        ts: Date.now(),
        system: true,
      },
    ],
    lastActiveAt: Date.now(),
  };
  rooms.set('PUBLIC', room);
  return room;
}

ensureDefaultPublicRoom();

function normalizeRoomId(raw: unknown): string {
  const cleaned = String(raw || 'PUBLIC')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 16);
  return cleaned || 'PUBLIC';
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: RoomState, payload: unknown, exceptPlayerId?: string): void {
  const raw = JSON.stringify(payload);
  for (const [pid, client] of room.players) {
    if (exceptPlayerId && pid === exceptPlayerId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function pushChat(room: RoomState, msg: ChatMessage): void {
  room.chatHistory.push(msg);
  if (room.chatHistory.length > 50) {
    room.chatHistory.shift();
  }
  broadcastRoom(room, { type: 'chat:msg', msg });
}

function pruneIdleRooms(): void {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (id === 'PUBLIC') continue;
    if (room.players.size === 0 && now - room.lastActiveAt > 1000 * 60 * 30) {
      rooms.delete(id);
    }
  }
}

setInterval(pruneIdleRooms, 60_000);

let geminiClient: GoogleGenAI | null = null;
const wyrTtsCache = new Map<string, Buffer>();
const WYR_VOICE_STYLES: Record<string, { voiceName: 'Fenrir' | 'Charon' | 'Puck'; style: string }> = {
  host: {
    voiceName: 'Fenrir',
    style: 'Charismatic, bold, energetic game-show host announcing a thrilling Would You Rather dilemma with dramatic pauses',
  },
  legend: {
    voiceName: 'Charon',
    style: 'Deep, cinematic, epic trailer narrator with cool gravelly confidence and dramatic weight',
  },
  hype: {
    voiceName: 'Puck',
    style: 'Fast, upbeat, hyped arcade announcer having a blast reading a wild Would You Rather challenge',
  },
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.post('/api/wyr/tts', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'TTS service unavailable' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const styleKey = typeof body.style === 'string' && body.style in WYR_VOICE_STYLES ? body.style : 'host';
    const voiceCfg = WYR_VOICE_STYLES[styleKey];
    const finished = Boolean(body.finished);
    const level = Math.max(1, Math.min(100, Number(body.level) || 1));
    const isMilestone = Boolean(body.isMilestone);
    const optionA = String(body.optionA || '').trim().slice(0, 140);
    const optionB = String(body.optionB || '').trim().slice(0, 140);

    if (!finished && (!optionA || !optionB)) {
      res.status(400).json({ error: 'optionA and optionB are required' });
      return;
    }

    const script = finished
      ? 'Incredible! You conquered all one hundred Would You Rather challenges! Step up and claim your Champion Trophy!'
      : level === 1
        ? `Question 1! Would you rather ${optionA}... or ${optionB}?`
        : isMilestone
          ? `Milestone Question ${level}! Would you rather ${optionA}... or ${optionB}?`
          : `Question ${level}! Would you rather ${optionA}... or ${optionB}?`;

    const cacheKey = `${styleKey}:${finished ? 'finish' : level}:${script}`;
    const cached = wyrTtsCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(cached);
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: script,
                speechMetadata: {
                  style: voiceCfg.style,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceCfg.voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'No audio returned from TTS model' });
        return;
      }

      const wavBuffer = Buffer.from(base64Audio, 'base64');
      if (wyrTtsCache.size >= 140) {
        const oldestKey = wyrTtsCache.keys().next().value;
        if (oldestKey) wyrTtsCache.delete(oldestKey);
      }
      wyrTtsCache.set(cacheKey, wavBuffer);

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(wavBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS generation failed';
      console.error('WYR TTS error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/rooms', (_req, res) => {
    ensureDefaultPublicRoom();
    const list = Array.from(rooms.values())
      .map((r) => ({
        id: r.id,
        name: r.name,
        seed: r.seed,
        worldType: r.worldType,
        mode: r.mode,
        playerCount: r.players.size,
        lastActiveAt: r.lastActiveAt,
      }))
      .sort((a, b) => {
        if (a.id === 'PUBLIC') return -1;
        if (b.id === 'PUBLIC') return 1;
        return b.playerCount - a.playerCount || b.lastActiveAt - a.lastActiveAt;
      });
    res.json({ rooms: list });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoom: RoomState | null = null;
    let playerId = makeId('p');

    const detachFromRoom = () => {
      if (!currentRoom) return;
      const entry = currentRoom.players.get(playerId);
      currentRoom.players.delete(playerId);
      currentRoom.lastActiveAt = Date.now();
      if (entry) {
        broadcastRoom(currentRoom, { type: 'player:left', playerId });
        pushChat(currentRoom, {
          id: makeId('sys'),
          senderId: 'server',
          senderName: 'Server',
          text: `${entry.state.name} left the world.`,
          ts: Date.now(),
          system: true,
        });
      }
      currentRoom = null;
    };

    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(rawData)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type;
      if (typeof type !== 'string') return;

      if (type === 'room:join') {
        detachFromRoom();

        const roomId = normalizeRoomId(msg.roomId);
        const playerName =
          String(msg.playerName || 'Player')
            .trim()
            .slice(0, 20) || 'Player';
        const skin = (msg.skin as PlayerSkinPayload | null) ?? null;

        let room = rooms.get(roomId);
        if (!room) {
          const create = (msg.create as Record<string, unknown> | undefined) ?? {};
          const rawWorldType = create.worldType;
          const worldType: WorldType =
            rawWorldType === 'skyblock' ||
            rawWorldType === 'tutorial' ||
            rawWorldType === 'parkour' ||
            rawWorldType === 'parkour100' ||
            rawWorldType === 'oneblock' ||
            rawWorldType === 'wouldyourather'
              ? rawWorldType
              : 'normal';
          const mode: GameMode =
            create.mode === 'creative'
              ? 'creative'
              : create.mode === 'hardcore'
                ? 'hardcore'
                : 'survival';
          const seed = String(create.seed || `mp-${roomId.toLowerCase()}`).slice(0, 48);
          const name = String(create.name || `Room ${roomId}`).trim().slice(0, 32) || `Room ${roomId}`;

          const modMap = new Map<string, number>();
          if (Array.isArray(create.modifiedBlocks)) {
            for (const pair of create.modifiedBlocks) {
              if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'number') {
                modMap.set(pair[0], pair[1]);
              }
            }
          }

          const chestMap = new Map<string, (InventorySlot | null)[]>();
          if (create.chests && typeof create.chests === 'object') {
            for (const [k, v] of Object.entries(create.chests as Record<string, unknown>)) {
              if (Array.isArray(v)) {
                chestMap.set(k, v as (InventorySlot | null)[]);
              }
            }
          }

          room = {
            id: roomId,
            name,
            seed,
            worldType,
            mode,
            timeOfDay: 0.055,
            dayCount: 1,
            modifiedBlocks: modMap,
            chests: chestMap,
            players: new Map(),
            chatHistory: [
              {
                id: makeId('sys'),
                senderId: 'server',
                senderName: 'Server',
                text: `Room ${roomId} created by ${playerName}! Share code ${roomId} with friends.`,
                ts: Date.now(),
                system: true,
              },
            ],
            lastActiveAt: Date.now(),
          };
          rooms.set(roomId, room);
        }

        currentRoom = room;
        room.lastActiveAt = Date.now();

        const spawnY =
          room.worldType === 'skyblock' || room.worldType === 'oneblock'
            ? 34
            : room.worldType === 'parkour' || room.worldType === 'parkour100' || room.worldType === 'wouldyourather'
              ? 33
              : room.worldType === 'tutorial'
                ? 27
                : 32;
        const playerState: RemotePlayerState = {
          id: playerId,
          name: playerName,
          skin,
          x: 0.5,
          y: spawnY,
          z: 0.5,
          yaw: 0,
          pitch: 0,
          heldItem: null,
          isMoving: false,
          voiceEnabled: false,
          voiceMuted: true,
          isSpeaking: false,
        };

        const existingPlayers = Array.from(room.players.values()).map((p) => p.state);
        room.players.set(playerId, { ws, state: playerState });

        sendJson(ws, {
          type: 'room:state',
          youId: playerId,
          room: {
            id: room.id,
            name: room.name,
            seed: room.seed,
            worldType: room.worldType,
            mode: room.mode,
            timeOfDay: room.timeOfDay,
            dayCount: room.dayCount,
          },
          modifiedBlocks: Array.from(room.modifiedBlocks.entries()),
          chests: Object.fromEntries(room.chests.entries()),
          players: existingPlayers,
          chatHistory: room.chatHistory,
        });

        broadcastRoom(room, { type: 'player:joined', player: playerState }, playerId);
        pushChat(room, {
          id: makeId('sys'),
          senderId: 'server',
          senderName: 'Server',
          text: `${playerName} joined the world.`,
          ts: Date.now(),
          system: true,
        });
        return;
      }

      if (!currentRoom) return;
      const playerEntry = currentRoom.players.get(playerId);
      if (!playerEntry) return;
      currentRoom.lastActiveAt = Date.now();

      if (type === 'player:move') {
        const x = Number(msg.x);
        const y = Number(msg.y);
        const z = Number(msg.z);
        const yaw = Number(msg.yaw);
        const pitch = Number(msg.pitch);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
        playerEntry.state.x = x;
        playerEntry.state.y = y;
        playerEntry.state.z = z;
        playerEntry.state.yaw = Number.isFinite(yaw) ? yaw : 0;
        playerEntry.state.pitch = Number.isFinite(pitch) ? pitch : 0;
        playerEntry.state.heldItem = typeof msg.heldItem === 'number' ? msg.heldItem : null;
        playerEntry.state.isMoving = Boolean(msg.isMoving);

        broadcastRoom(
          currentRoom,
          {
            type: 'player:moved',
            playerId,
            x: playerEntry.state.x,
            y: playerEntry.state.y,
            z: playerEntry.state.z,
            yaw: playerEntry.state.yaw,
            pitch: playerEntry.state.pitch,
            heldItem: playerEntry.state.heldItem,
            isMoving: playerEntry.state.isMoving,
          },
          playerId
        );
        return;
      }

      if (type === 'player:swing') {
        broadcastRoom(currentRoom, { type: 'player:swung', playerId }, playerId);
        return;
      }

      if (type === 'player:skin') {
        const skin = (msg.skin as PlayerSkinPayload | null) ?? null;
        playerEntry.state.skin = skin;
        broadcastRoom(currentRoom, { type: 'player:skinned', playerId, skin }, playerId);
        return;
      }

      if (type === 'block:set') {
        const wx = Math.floor(Number(msg.wx));
        const wy = Math.floor(Number(msg.wy));
        const wz = Math.floor(Number(msg.wz));
        const blockId = Math.floor(Number(msg.blockId));
        if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(wz) || !Number.isFinite(blockId)) {
          return;
        }
        if (wy < 0 || wy >= 128) return;
        const key = `${wx},${wy},${wz}`;
        currentRoom.modifiedBlocks.set(key, blockId);
        if (blockId === 0) {
          currentRoom.chests.delete(key);
        }
        broadcastRoom(
          currentRoom,
          { type: 'block:set', wx, wy, wz, blockId, byId: playerId },
          playerId
        );
        return;
      }

      if (type === 'chest:update') {
        const key = String(msg.key || '');
        if (!key || !Array.isArray(msg.slots)) return;
        const cleanSlots = (msg.slots as (InventorySlot | null)[]).slice(0, 27);
        currentRoom.chests.set(key, cleanSlots);
        broadcastRoom(
          currentRoom,
          { type: 'chest:updated', key, slots: cleanSlots, byId: playerId },
          playerId
        );
        return;
      }

      if (type === 'chat:send') {
        const text = String(msg.text || '').trim().slice(0, 220);
        if (!text) return;
        pushChat(currentRoom, {
          id: makeId('chat'),
          senderId: playerId,
          senderName: playerEntry.state.name,
          text,
          ts: Date.now(),
        });
        return;
      }

      if (type === 'voice:state') {
        const voiceEnabled = Boolean(msg.voiceEnabled);
        const voiceMuted = Boolean(msg.voiceMuted);
        const isSpeaking = voiceEnabled && !voiceMuted && Boolean(msg.isSpeaking);
        playerEntry.state.voiceEnabled = voiceEnabled;
        playerEntry.state.voiceMuted = voiceMuted;
        playerEntry.state.isSpeaking = isSpeaking;
        broadcastRoom(
          currentRoom,
          {
            type: 'player:voice',
            playerId,
            voiceEnabled,
            voiceMuted,
            isSpeaking,
          },
          playerId
        );
        return;
      }

      if (type === 'rtc:signal') {
        const targetId = String(msg.targetId || '');
        if (!targetId || !msg.signal) return;
        const target = currentRoom.players.get(targetId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          sendJson(target.ws, {
            type: 'rtc:signal',
            fromId: playerId,
            signal: msg.signal,
          });
        }
      }
    });

    ws.on('close', detachFromRoom);
    ws.on('error', detachFromRoom);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Minecraft Play server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
