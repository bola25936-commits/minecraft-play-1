import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameMenu } from './components/GameMenu';
import { InventoryModal } from './components/InventoryModal';
import { TntIntroScreen } from './components/TntIntroScreen';
import { VoxelGameEngine } from './game/engine';
import { createEmptyBlockInventory } from './game/inventory';
import {
  BehaviorPackId,
  BONUS_MINEDOLLARS,
  loadActiveBehaviorPacks,
  loadActiveResourcePack,
  loadMineDollars,
  loadOwnedMarketplaceIds,
  MARKETPLACE_SKIN_PACKS,
  MarketplaceBundleItem,
  MarketplaceItem,
  MarketplaceSkinItem,
  saveActiveBehaviorPacks,
  saveActiveResourcePack,
  saveMineDollars,
  saveOwnedMarketplaceIds,
} from './game/marketplace';
import {
  ChatMessage,
  ConnectionStatus,
  loadPlayerName,
  MultiplayerClient,
  RemotePlayerState,
  RoomInfo,
  savePlayerName,
} from './game/multiplayer';
import {
  DEFAULT_SKINS,
  getActiveSkinId,
  loadAllSkins,
  PlayerSkin,
  saveActiveSkinId,
  saveCustomSkins,
} from './game/skins';
import { TexturePackId } from './game/textures';
import {
  BlockId,
  createEmptyArmor,
  GameMode,
  GamePhase,
  HudSnapshot,
  SavedWorldData,
  WorldType,
} from './game/types';
import { VoiceChatManager, VoiceSpatialMode, VoiceStateSnapshot } from './game/voiceChat';
import {
  deleteSavedWorld,
  getActiveWorldId,
  loadSavedWorlds,
  renameSavedWorld,
  setActiveWorldId,
  upsertSavedWorld,
} from './game/worldsStorage';

const INITIAL_HUD: HudSnapshot = {
  worldId: '',
  worldName: 'Emerald Valley',
  worldType: 'normal',
  dimension: 'overworld',
  portalChargeProgress: 0,
  health: 20,
  maxHealth: 20,
  hunger: 20,
  maxHunger: 20,
  armor: createEmptyArmor(),
  armorDefense: 0,
  selectedSlot: 0,
  inventory: createEmptyBlockInventory(),
  mode: 'survival',
  dayCount: 1,
  timeOfDay: 0.055,
  coords: { x: 0, y: 28, z: 0 },
  biome: 'Plains',
  isUnderground: false,
  isFlying: false,
  isUnderwater: false,
  pointerLocked: false,
  targetBlockName: null,
  breakProgress: 0,
  blocksMined: 0,
  blocksPlaced: 0,
  mobsDefeated: 0,
  craftingGridSize: 2,
  activeStation: 'inventory',
  activeChestPos: null,
  chestSlots: [],
  statusMessage: null,
  twoPlayerMode: false,
};

function buildSkinRoster(ownedIds: string[], baseSkins: PlayerSkin[]): PlayerSkin[] {
  const ownedSet = new Set(ownedIds);
  const unlockedMpSkins = MARKETPLACE_SKIN_PACKS.filter((m) => ownedSet.has(m.id)).map((m) => m.skin);
  const seen = new Set<string>();
  const merged: PlayerSkin[] = [];
  for (const s of [...baseSkins, ...unlockedMpSkins]) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
    }
  }
  return merged;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelGameEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const voiceRef = useRef<VoiceChatManager | null>(null);

  const [savedWorlds, setSavedWorlds] = useState<SavedWorldData[]>(() => loadSavedWorlds());
  const [showIntro, setShowIntro] = useState(true);
  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(() => {
    const worlds = loadSavedWorlds();
    const activeId = getActiveWorldId();
    const initial = worlds.find((w) => w.id === activeId) ?? worlds[0];
    return initial
      ? {
          ...INITIAL_HUD,
          worldId: initial.id,
          worldName: initial.name,
          worldType: initial.worldType ?? 'normal',
          mode: initial.mode,
          dayCount: initial.dayCount,
        }
      : INITIAL_HUD;
  });
  const [twoPlayerMode, setTwoPlayerMode] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(() => {
    const worlds = loadSavedWorlds();
    const activeId = getActiveWorldId();
    const initial = worlds.find((w) => w.id === activeId) ?? worlds[0];
    return initial?.mode ?? 'survival';
  });
  const [seedInput, setSeedInput] = useState(() => {
    const worlds = loadSavedWorlds();
    const activeId = getActiveWorldId();
    const initial = worlds.find((w) => w.id === activeId) ?? worlds[0];
    return initial?.seed ?? 'voxel-valley-2026';
  });
  const [muted, setMuted] = useState(false);
  const [renderDistance, setRenderDistance] = useState(5);
  const [sensitivity, setSensitivity] = useState(22);
  const [fov, setFov] = useState(72);
  const [mineDollars, setMineDollars] = useState<bigint>(() => loadMineDollars());
  const [ownedMpIds, setOwnedMpIds] = useState<string[]>(() => loadOwnedMarketplaceIds());
  const [activeBehaviorPacks, setActiveBehaviorPacks] = useState<BehaviorPackId[]>(() =>
    loadActiveBehaviorPacks()
  );
  const [texturePack, setTexturePack] = useState<TexturePackId>(() => loadActiveResourcePack());
  const [weatherMode, setWeatherMode] = useState<'auto' | 'clear' | 'rain'>('auto');
  const [skins, setSkins] = useState<PlayerSkin[]>(() =>
    buildSkinRoster(loadOwnedMarketplaceIds(), loadAllSkins())
  );
  const [activeSkinId, setActiveSkinId] = useState<string>(() => getActiveSkinId());

  const [playerName, setPlayerName] = useState<string>(() => loadPlayerName());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceStateSnapshot>({
    enabled: false,
    muted: true,
    speaking: false,
    spatialMode: 'global',
    error: null,
    connectedPeerCount: 0,
  });
  const [initialJoinCode] = useState<string | undefined>(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase();
      return code || undefined;
    } catch {
      return undefined;
    }
  });

  const activeSkin = skins.find((s) => s.id === activeSkinId) ?? DEFAULT_SKINS[0];

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const existingWorlds = loadSavedWorlds();
    const activeId = getActiveWorldId();
    const initialWorld = existingWorlds.find((w) => w.id === activeId) ?? existingWorlds[0];

    const voice = new VoiceChatManager({
      sendSignal: (targetId, signal) => mpClientRef.current?.sendRtcSignal(targetId, signal),
      sendVoiceState: (voiceEnabled, voiceMuted, isSpeaking) =>
        mpClientRef.current?.sendVoiceState(voiceEnabled, voiceMuted, isSpeaking),
      onStateChange: (snap) => setVoiceState(snap),
    });
    voiceRef.current = voice;

    const mp = new MultiplayerClient({
      onStatusChange: (status, room) => {
        setConnectionStatus(status);
        setActiveRoom(room);
        if (status === 'offline') {
          setRemotePlayers([]);
          setChatMessages([]);
          voice.syncRoomPeers(null, []);
          voice.leaveVoice();
        }
      },
      onRoomState: (payload) => {
        setActiveRoom(payload.room);
        setSelectedMode(payload.room.mode);
        setRemotePlayers(payload.players);
        setChatMessages(payload.chatHistory.slice(-60));
        setChatOpen(false);
        engineRef.current?.setInputSuppressed(false);
        engineRef.current?.joinMultiplayerRoom({
          room: payload.room,
          modifiedBlocks: payload.modifiedBlocks,
          chests: payload.chests,
          players: payload.players,
        });
        voice.syncRoomPeers(payload.youId, payload.players);
      },
      onPlayerJoined: (player) => {
        setRemotePlayers((prev) =>
          prev.some((p) => p.id === player.id) ? prev : [...prev, player]
        );
        engineRef.current?.upsertRemotePlayer(player);
        voice.onPeerJoined(player.id, Boolean(player.voiceEnabled));
      },
      onPlayerLeft: (playerId) => {
        setRemotePlayers((prev) => prev.filter((p) => p.id !== playerId));
        engineRef.current?.removeRemotePlayer(playerId);
        voice.onPeerLeft(playerId);
      },
      onPlayerMoved: (data) => {
        engineRef.current?.moveRemotePlayer(data);
      },
      onPlayerSwung: (playerId) => {
        engineRef.current?.swingRemotePlayer(playerId);
      },
      onPlayerSkinned: (playerId, skin) => {
        setRemotePlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, skin } : p))
        );
        engineRef.current?.skinRemotePlayer(playerId, skin);
      },
      onBlockSet: (wx, wy, wz, blockId) => {
        engineRef.current?.applyRemoteBlock(wx, wy, wz, blockId);
      },
      onChestUpdated: (key, slots) => {
        engineRef.current?.applyRemoteChest(key, slots);
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-59), msg]);
      },
      onPlayerVoice: (data) => {
        setRemotePlayers((prev) =>
          prev.map((p) =>
            p.id === data.playerId
              ? {
                  ...p,
                  voiceEnabled: data.voiceEnabled,
                  voiceMuted: data.voiceMuted,
                  isSpeaking: data.isSpeaking,
                }
              : p
          )
        );
        engineRef.current?.setRemotePlayerSpeaking(data.playerId, data.isSpeaking);
        voice.onPeerVoiceUpdated(data.playerId, data.voiceEnabled);
      },
      onRtcSignal: (fromId, signal) => {
        void voice.handleSignal(fromId, signal);
      },
    });
    mpClientRef.current = mp;

    const engine = new VoxelGameEngine(
      mount,
      {
        onHudUpdate: (snapshot) => setHud(snapshot),
        onPhaseChange: (nextPhase) => {
          setPhase(nextPhase);
          if (nextPhase !== 'playing') {
            setChatOpen(false);
            engineRef.current?.setInputSuppressed(false);
          }
        },
        onSaveWorld: (save) => {
          const next = upsertSavedWorld(save);
          setSavedWorlds(next);
        },
        onLocalBlockSet: (wx, wy, wz, blockId) => {
          mpClientRef.current?.sendBlockSet(wx, wy, wz, blockId);
        },
        onLocalChestUpdate: (key, slots) => {
          mpClientRef.current?.sendChestUpdate(key, slots);
        },
        onLocalMove: (x, y, z, yaw, pitch, heldItem, isMoving) => {
          mpClientRef.current?.sendMove(x, y, z, yaw, pitch, heldItem, isMoving);
        },
        onLocalSwing: () => {
          mpClientRef.current?.sendSwing();
        },
        onOpenChat: () => {
          setChatOpen(true);
          engineRef.current?.setInputSuppressed(true);
        },
        onToggleVoice: () => {
          void voiceRef.current?.toggleMic();
        },
      },
      initialWorld
    );
    engineRef.current = engine;

    const initialResourcePack = loadActiveResourcePack();
    if (initialResourcePack !== 'pbr') {
      engine.setTexturePack(initialResourcePack);
    }
    const initialBehaviors = loadActiveBehaviorPacks();
    if (initialBehaviors.length > 0) {
      engine.setActiveBehaviorPacks(initialBehaviors);
    }
    const initialSkins = buildSkinRoster(loadOwnedMarketplaceIds(), loadAllSkins());
    const initialSkin = initialSkins.find((s) => s.id === getActiveSkinId()) ?? DEFAULT_SKINS[0];
    engine.setPlayerSkin(initialSkin);

    const spatialTimer = window.setInterval(() => {
      if (!engineRef.current || !voiceRef.current) return;
      const spatial = engineRef.current.getSpatialVoiceState();
      voiceRef.current.updateSpatialVolumes(spatial.selfPos, spatial.peerPositions);
    }, 120);

    const handleBeforeUnload = () => {
      if (engineRef.current && engineRef.current.phase !== 'title') {
        engineRef.current.triggerAutoSave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(spatialTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (engine.phase !== 'title') {
        engine.triggerAutoSave();
      }
      voice.dispose();
      voiceRef.current = null;
      mp.disconnect();
      mpClientRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  const handleSelectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    if (phase !== 'title') {
      engineRef.current?.setGameMode(mode);
    }
  };

  const leaveOnlineIfNeeded = () => {
    if (connectionStatus !== 'offline' || activeRoom) {
      voiceRef.current?.leaveVoice();
      voiceRef.current?.syncRoomPeers(null, []);
      mpClientRef.current?.disconnect();
      engineRef.current?.leaveMultiplayerRoom();
      setActiveRoom(null);
      setRemotePlayers([]);
      setChatMessages([]);
      setChatOpen(false);
    }
  };

  const handleStartWorld = (mode?: GameMode, seed?: string) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    const targetSeed = (seed ?? seedInput).trim() || 'voxel-valley-2026';
    setSelectedMode(targetMode);
    setSeedInput(targetSeed);
    engineRef.current?.startGame(targetMode, targetSeed);
  };

  const handlePlaySkyblock = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('skyblock-island-1');
    engineRef.current?.createNewWorld('skyblock-island-1', targetMode, true, 'Skyblock Island', undefined, 'skyblock');
  };

  const handlePlayTutorial = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('tutorial-camp-1');
    engineRef.current?.createNewWorld('tutorial-camp-1', targetMode, true, 'Tutorial World', undefined, 'tutorial');
  };

  const handlePlayParkour = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('parkour-course-1');
    engineRef.current?.createNewWorld('parkour-course-1', targetMode, true, 'Parkour Course', undefined, 'parkour');
  };

  const handleToggleTwoPlayerMode = () => {
    const next = !twoPlayerMode;
    setTwoPlayerMode(next);
    engineRef.current?.setTwoPlayerMode(next);
  };

  const handlePlayOneBlock = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('oneblock-sky-1');
    engineRef.current?.createNewWorld('oneblock-sky-1', targetMode, true, 'One Block Challenge', undefined, 'oneblock');
  };

  const handlePlayParkour100 = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('parkour100-mega-1');
    engineRef.current?.createNewWorld('parkour100-mega-1', targetMode, true, '100-Level Parkour', undefined, 'parkour100');
  };

  const handlePlayWouldYouRather = (mode?: GameMode) => {
    leaveOnlineIfNeeded();
    const targetMode = mode ?? selectedMode;
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(targetMode);
    setSeedInput('wyr100-mega-1');
    engineRef.current?.createNewWorld('wyr100-mega-1', targetMode, true, '100-Level Would You Rather', undefined, 'wouldyourather');
  };

  const handleLoadWorld = (world: SavedWorldData) => {
    leaveOnlineIfNeeded();
    if (phase === 'paused' && hud.worldId && hud.worldId !== world.id) {
      engineRef.current?.triggerAutoSave();
    }
    setActiveWorldId(world.id);
    setSelectedMode(world.mode);
    setSeedInput(world.seed);
    engineRef.current?.loadSavedWorld(world, true);
  };

  const handleCreateWorld = (name: string, mode: GameMode, seed: string, worldType: WorldType = 'normal') => {
    leaveOnlineIfNeeded();
    if (phase === 'paused') {
      engineRef.current?.triggerAutoSave();
    }
    setSelectedMode(mode);
    setSeedInput(seed);
    engineRef.current?.createNewWorld(seed, mode, true, name, undefined, worldType);
  };

  const handleDeleteWorld = (id: string) => {
    const next = deleteSavedWorld(id);
    setSavedWorlds(next);
    if (hud.worldId === id && engineRef.current) {
      if (next[0]) {
        setSelectedMode(next[0].mode);
        setSeedInput(next[0].seed);
        engineRef.current.loadSavedWorld(next[0], false);
      } else {
        setSelectedMode('survival');
        setSeedInput('voxel-valley-2026');
        engineRef.current.createNewWorld('voxel-valley-2026', 'survival', false, 'Emerald Valley');
      }
    }
  };

  const handleRenameWorld = (id: string, name: string) => {
    const next = renameSavedWorld(id, name);
    setSavedWorlds(next);
    if (hud.worldId === id) {
      engineRef.current?.renameCurrentWorld(name);
    }
  };

  const handleResume = () => {
    setChatOpen(false);
    engineRef.current?.setInputSuppressed(false);
    engineRef.current?.setPhase('playing');
    engineRef.current?.requestPointerLock();
  };

  const handleEquipSkin = (id: string) => {
    saveActiveSkinId(id);
    setActiveSkinId(id);
    const chosen = skins.find((s) => s.id === id) ?? DEFAULT_SKINS[0];
    engineRef.current?.setPlayerSkin(chosen);
    mpClientRef.current?.sendSkinUpdate(chosen);
  };

  const handleSaveSkin = (skin: PlayerSkin, equip = false) => {
    setSkins((prev) => {
      const custom = prev.filter((s) => !s.builtIn);
      const idx = custom.findIndex((s) => s.id === skin.id);
      const nextCustom = idx >= 0 ? custom.map((s) => (s.id === skin.id ? skin : s)) : [skin, ...custom];
      saveCustomSkins(nextCustom);
      return buildSkinRoster(ownedMpIds, [...nextCustom, ...DEFAULT_SKINS]);
    });
    if (equip) {
      saveActiveSkinId(skin.id);
      setActiveSkinId(skin.id);
      engineRef.current?.setPlayerSkin(skin);
      mpClientRef.current?.sendSkinUpdate(skin);
    }
  };

  const handleDeleteSkin = (id: string) => {
    setSkins((prev) => {
      const nextCustom = prev.filter((s) => !s.builtIn && s.id !== id);
      saveCustomSkins(nextCustom);
      return buildSkinRoster(ownedMpIds, [...nextCustom, ...DEFAULT_SKINS]);
    });
    if (activeSkinId === id) {
      const fallback = DEFAULT_SKINS[0];
      saveActiveSkinId(fallback.id);
      setActiveSkinId(fallback.id);
      engineRef.current?.setPlayerSkin(fallback);
      mpClientRef.current?.sendSkinUpdate(fallback);
    }
  };

  const handleEquipResourcePack = (packId: TexturePackId) => {
    setTexturePack(packId);
    saveActiveResourcePack(packId);
    engineRef.current?.setTexturePack(packId);
  };

  const handleToggleBehaviorPack = (packId: BehaviorPackId) => {
    setActiveBehaviorPacks((prev) => {
      const next = prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId];
      saveActiveBehaviorPacks(next);
      engineRef.current?.setActiveBehaviorPacks(next);
      return next;
    });
  };

  const handleEquipSkinFromMarketplace = (skinItem: MarketplaceSkinItem) => {
    setSkins((prev) =>
      prev.some((s) => s.id === skinItem.skin.id) ? prev : [...prev, skinItem.skin]
    );
    saveActiveSkinId(skinItem.skin.id);
    setActiveSkinId(skinItem.skin.id);
    engineRef.current?.setPlayerSkin(skinItem.skin);
    mpClientRef.current?.sendSkinUpdate(skinItem.skin);
  };

  const handleLaunchMarketplaceWorld = (bundle: MarketplaceBundleItem) => {
    if (!bundle.worldPreset) return;
    const { worldName, mode, seed, worldType } = bundle.worldPreset;
    handleCreateWorld(worldName, mode, seed, worldType);
  };

  const handleClaimBonusMineDollars = () => {
    setMineDollars((prev) => {
      const next = prev + BONUS_MINEDOLLARS;
      saveMineDollars(next);
      return next;
    });
  };

  const handleBuyMarketplaceItem = (item: MarketplaceItem) => {
    if (mineDollars < item.price) return;
    const nextBalance = mineDollars - item.price;
    setMineDollars(nextBalance);
    saveMineDollars(nextBalance);

    if (!ownedMpIds.includes(item.id)) {
      const nextOwned = [...ownedMpIds, item.id];
      setOwnedMpIds(nextOwned);
      saveOwnedMarketplaceIds(nextOwned);
    }

    if (item.category === 'resource') {
      handleEquipResourcePack(item.packId);
    } else if (item.category === 'behavior') {
      setActiveBehaviorPacks((prev) => {
        const next = prev.includes(item.id) ? prev : [...prev, item.id];
        saveActiveBehaviorPacks(next);
        engineRef.current?.setActiveBehaviorPacks(next);
        return next;
      });
    } else if (item.category === 'skins') {
      handleEquipSkinFromMarketplace(item);
    } else if (item.category === 'bundles') {
      if (item.supplyItems) {
        engineRef.current?.grantMarketplaceItems(item.supplyItems);
      }
      if (item.worldPreset) {
        handleLaunchMarketplaceWorld(item);
      }
    }
  };

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    savePlayerName(name);
  };

  const handleJoinRoom = (roomId: string) => {
    const cleanName = playerName.trim() || 'Player';
    savePlayerName(cleanName);
    mpClientRef.current?.connectAndJoin({
      roomId: roomId.trim().toUpperCase() || 'PUBLIC',
      playerName: cleanName,
      skin: activeSkin,
    });
  };

  const handleHostRoom = (opts: {
    roomId: string;
    name: string;
    seed: string;
    worldType: WorldType;
    mode: GameMode;
    copyCurrentWorld?: boolean;
  }) => {
    const cleanName = playerName.trim() || 'Player';
    savePlayerName(cleanName);
    const exported = opts.copyCurrentWorld ? engineRef.current?.exportWorldSave() : undefined;
    mpClientRef.current?.connectAndJoin({
      roomId: opts.roomId.trim().toUpperCase(),
      playerName: cleanName,
      skin: activeSkin,
      create: {
        name: opts.name,
        seed: opts.seed,
        worldType: opts.worldType,
        mode: opts.mode,
        modifiedBlocks: exported?.modifiedBlocks,
        chests: exported?.chestInventories,
      },
    });
  };

  const handleDisconnectMultiplayer = () => {
    voiceRef.current?.leaveVoice();
    voiceRef.current?.syncRoomPeers(null, []);
    mpClientRef.current?.disconnect();
    engineRef.current?.leaveMultiplayerRoom();
    setActiveRoom(null);
    setRemotePlayers([]);
    setChatMessages([]);
    setChatOpen(false);
  };

  const handleToggleVoice = () => {
    void voiceRef.current?.toggleMic();
  };

  const handleLeaveVoice = () => {
    voiceRef.current?.leaveVoice();
  };

  const handleVoiceSpatialModeChange = (mode: VoiceSpatialMode) => {
    voiceRef.current?.setSpatialMode(mode);
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    engineRef.current?.setInputSuppressed(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    engineRef.current?.setInputSuppressed(false);
    engineRef.current?.requestPointerLock();
  };

  const handleSendChat = (text: string) => {
    mpClientRef.current?.sendChat(text);
  };

  const getIcon = (id: BlockId) => engineRef.current?.getIcon(id) ?? '';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d1117] text-white">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 h-full w-full" />

      {/* OPENING TNT INTRO SCREEN */}
      {showIntro && <TntIntroScreen onComplete={() => setShowIntro(false)} />}

      {/* MAIN TITLE MENU & IN-GAME MENU OVERLAYS */}
      {(phase === 'title' || phase === 'paused') && (
        <GameMenu
          variant={phase === 'title' ? 'title' : 'pause'}
          hud={hud}
          selectedMode={selectedMode}
          seedInput={seedInput}
          savedWorlds={savedWorlds}
          activeWorldId={hud.worldId}
          muted={muted}
          renderDistance={renderDistance}
          sensitivity={sensitivity}
          fov={fov}
          texturePack={texturePack}
          weatherMode={weatherMode}
          twoPlayerMode={twoPlayerMode}
          onToggleTwoPlayerMode={handleToggleTwoPlayerMode}
          onSelectMode={handleSelectMode}
          onSeedChange={setSeedInput}
          onStartWorld={handleStartWorld}
          onPlayOneBlock={handlePlayOneBlock}
          onPlaySkyblock={handlePlaySkyblock}
          onPlayTutorial={handlePlayTutorial}
          onPlayParkour={handlePlayParkour}
          onPlayParkour100={handlePlayParkour100}
          onPlayWouldYouRather={handlePlayWouldYouRather}
          onLoadWorld={handleLoadWorld}
          onCreateWorld={handleCreateWorld}
          onDeleteWorld={handleDeleteWorld}
          onRenameWorld={handleRenameWorld}
          onResume={handleResume}
          onReturnTitle={() => engineRef.current?.setPhase('title')}
          onToggleMute={handleToggleMute}
          onRenderDistanceChange={(v) => {
            setRenderDistance(v);
            engineRef.current?.setRenderDistance(v);
          }}
          onSensitivityChange={(v) => {
            setSensitivity(v);
            engineRef.current?.setSensitivity(v * 0.0001);
          }}
          onFovChange={(v) => {
            setFov(v);
            engineRef.current?.setFov(v);
          }}
          onTimeOfDayChange={(tod) => {
            engineRef.current?.setTimeOfDay(tod);
          }}
          onTexturePackChange={(pack) => {
            handleEquipResourcePack(pack);
          }}
          onRegenerateSquarePack={() => {
            setTexturePack('square');
            saveActiveResourcePack('square');
            engineRef.current?.regenerateSquareTexturePack();
          }}
          onWeatherModeChange={(mode) => {
            setWeatherMode(mode);
            engineRef.current?.setWeatherMode(mode);
          }}
          skins={skins}
          activeSkin={activeSkin}
          onEquipSkin={handleEquipSkin}
          onSaveSkin={handleSaveSkin}
          onDeleteSkin={handleDeleteSkin}
          playerName={playerName}
          onPlayerNameChange={handlePlayerNameChange}
          connectionStatus={connectionStatus}
          activeRoom={activeRoom}
          remotePlayers={remotePlayers}
          initialJoinCode={initialJoinCode}
          onJoinRoom={handleJoinRoom}
          onHostRoom={handleHostRoom}
          onDisconnectMultiplayer={handleDisconnectMultiplayer}
          voiceState={voiceState}
          onToggleVoice={handleToggleVoice}
          onLeaveVoice={handleLeaveVoice}
          onVoiceSpatialModeChange={handleVoiceSpatialModeChange}
          mineDollars={mineDollars}
          ownedMarketplaceIds={ownedMpIds}
          activeBehaviorPacks={activeBehaviorPacks}
          onBuyMarketplaceItem={handleBuyMarketplaceItem}
          onEquipResourcePack={handleEquipResourcePack}
          onToggleBehaviorPack={handleToggleBehaviorPack}
          onEquipSkinFromMarketplace={handleEquipSkinFromMarketplace}
          onLaunchMarketplaceWorld={handleLaunchMarketplaceWorld}
          onClaimBonusMineDollars={handleClaimBonusMineDollars}
        />
      )}

      {/* IN-GAME HUD */}
      {phase === 'playing' && (
        <GameHud
          hud={hud}
          activeSkin={activeSkin}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenPause={() => engineRef.current?.setPhase('paused')}
          onOpenInventory={() => engineRef.current?.openInventory()}
          onSelectSlot={(idx) => engineRef.current?.setSelectedSlot(idx)}
          getIcon={getIcon}
          connectionStatus={connectionStatus}
          activeRoom={activeRoom}
          remotePlayers={remotePlayers}
          chatMessages={chatMessages}
          chatOpen={chatOpen}
          onOpenChat={handleOpenChat}
          onCloseChat={handleCloseChat}
          onSendChat={handleSendChat}
          voiceState={voiceState}
          onToggleVoice={handleToggleVoice}
        />
      )}

      {/* INVENTORY & STATION MODAL */}
      {phase === 'inventory' && (
        <InventoryModal
          hud={hud}
          getIcon={getIcon}
          onClose={handleResume}
          onTransferSlot={(fromContainer, fromIdx, toContainer, toIdx) =>
            engineRef.current?.transferContainerSlots(fromContainer, fromIdx, toContainer, toIdx)
          }
          onQuickTransferSlot={(container, idx) =>
            engineRef.current?.quickTransferContainerSlot(container, idx)
          }
          onInteractArmorSlot={(slotKey, container, idx) =>
            engineRef.current?.interactArmorSlot(slotKey, container, idx)
          }
          onQuickEquipArmor={(container, idx) =>
            engineRef.current?.quickEquipArmorFromSlot(container, idx) ?? false
          }
          onCraftRecipe={(recipe) => engineRef.current?.craftRecipe(recipe) ?? false}
          onGiveCreative={(id) => engineRef.current?.giveCreativeItem(id)}
        />
      )}

      {/* GAME OVER MODAL */}
      {phase === 'gameover' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#2b0909]/82 p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-none border-2 border-rose-500/50 bg-[#171216] p-6 text-center shadow-2xl">
            <div className="flex flex-col items-center gap-1">
              {hud.mode === 'hardcore' && (
                <span className="border border-rose-500/60 bg-rose-950/90 px-2 py-0.5 text-[10px] font-black tracking-widest text-rose-300 uppercase">
                  Hardcore Permadeath
                </span>
              )}
              <h2 className="text-2xl font-black tracking-wider text-rose-400 uppercase">
                {hud.mode === 'hardcore' ? 'World Lost!' : 'You Died'}
              </h2>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 rounded-none border border-white/10 bg-[#100d10] p-3 text-xs">
              <div>
                <div className="text-slate-400">Days</div>
                <div className="tabular-nums text-base font-bold text-white">{hud.dayCount}</div>
              </div>
              <div>
                <div className="text-slate-400">Mined</div>
                <div className="tabular-nums text-base font-bold text-amber-300">{hud.blocksMined}</div>
              </div>
              <div>
                <div className="text-slate-400">Mobs</div>
                <div className="tabular-nums text-base font-bold text-emerald-300">{hud.mobsDefeated}</div>
              </div>
            </div>

            {hud.mode === 'hardcore' ? (
              <>
                <button
                  type="button"
                  onClick={() => engineRef.current?.spectateHardcoreWorld()}
                  className="w-full rounded-none border-b-4 border-sky-800 bg-sky-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400"
                >
                  Spectate World
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (hud.worldId) handleDeleteWorld(hud.worldId);
                    engineRef.current?.setPhase('title');
                  }}
                  className="w-full rounded-none border border-rose-500/40 bg-rose-950/60 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900/70"
                >
                  Delete Hardcore World &amp; Title
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => engineRef.current?.respawn()}
                  className="w-full rounded-none border-b-4 border-emerald-700 bg-emerald-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Respawn
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.setPhase('title')}
                  className="w-full rounded-none border border-white/15 bg-[#201a20] py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Main Menu
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
