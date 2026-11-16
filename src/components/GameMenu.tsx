import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Compass,
  FolderOpen,
  Gamepad2,
  Globe,
  Moon,
  Palette,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  Skull,
  Sliders,
  Sparkles,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  BehaviorPackId,
  BONUS_MINEDOLLARS,
  formatMineDollarsCompact,
  formatMineDollarsExact,
  MARKETPLACE_RESOURCE_PACKS,
  MarketplaceBundleItem,
  MarketplaceItem,
  MarketplaceSkinItem,
} from '../game/marketplace';
import { ConnectionStatus, RemotePlayerState, RoomInfo } from '../game/multiplayer';
import { PlayerSkin, renderSkinFaceDataUrl } from '../game/skins';
import { TexturePackId } from '../game/textures';
import { GameMode, HudSnapshot, SavedWorldData, WorldType } from '../game/types';
import { VoiceSpatialMode, VoiceStateSnapshot } from '../game/voiceChat';
import { MarketplacePanel } from './MarketplacePanel';
import { MenuDuelCanvas } from './MenuDuelCanvas';
import { MenuFireBackdrop } from './MenuFireBackdrop';
import { MultiplayerPanel } from './MultiplayerPanel';
import { SkinMakerPanel } from './SkinMakerPanel';

type MenuTab = 'home' | 'worlds' | 'multiplayer' | 'skins' | 'marketplace' | 'settings' | 'controls';

interface PresetWorld {
  label: string;
  seed: string;
  tag: string;
  worldType?: WorldType;
}

const PRESET_WORLDS: PresetWorld[] = [
  { label: 'One Block', seed: 'oneblock-sky-1', tag: '1-Block Evolving Sky', worldType: 'oneblock' },
  { label: '100-Level Parkour', seed: 'parkour100-mega-1', tag: '100 Levels · 10 Biomes', worldType: 'parkour100' },
  { label: 'Would You Rather (100)', seed: 'wyr100-mega-1', tag: '100 Choices & Rewards', worldType: 'wouldyourather' },
  { label: 'Parkour Course', seed: 'parkour-course-1', tag: 'Sky Jumps & Summit', worldType: 'parkour' },
  { label: 'Tutorial World', seed: 'tutorial-camp-1', tag: 'Guided Base Camp', worldType: 'tutorial' },
  { label: 'Skyblock Island', seed: 'skyblock-island-1', tag: 'Floating Void Map', worldType: 'skyblock' },
  { label: 'Emerald Valley', seed: 'voxel-valley-2026', tag: 'Meadows & Rivers' },
  { label: 'Alpine Peaks', seed: 'alpine-ridge-884', tag: 'Snowy Mountains' },
];

interface GameMenuProps {
  variant: 'title' | 'pause';
  hud: HudSnapshot;
  selectedMode: GameMode;
  seedInput: string;
  savedWorlds: SavedWorldData[];
  activeWorldId: string;
  muted: boolean;
  renderDistance: number;
  sensitivity: number;
  fov: number;
  texturePack: TexturePackId;
  weatherMode: 'auto' | 'clear' | 'rain';
  onSelectMode: (mode: GameMode) => void;
  onSeedChange: (seed: string) => void;
  onStartWorld: (mode?: GameMode, seed?: string) => void;
  onPlayOneBlock: (mode?: GameMode) => void;
  onPlaySkyblock: (mode?: GameMode) => void;
  onPlayTutorial: (mode?: GameMode) => void;
  onPlayParkour: (mode?: GameMode) => void;
  onPlayParkour100: (mode?: GameMode) => void;
  onPlayWouldYouRather: (mode?: GameMode) => void;
  twoPlayerMode: boolean;
  onToggleTwoPlayerMode: () => void;
  onLoadWorld: (world: SavedWorldData) => void;
  onCreateWorld: (name: string, mode: GameMode, seed: string, worldType?: WorldType) => void;
  onDeleteWorld: (id: string) => void;
  onRenameWorld: (id: string, name: string) => void;
  onResume: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onRenderDistanceChange: (val: number) => void;
  onSensitivityChange: (val: number) => void;
  onFovChange: (val: number) => void;
  onTimeOfDayChange: (tod: number) => void;
  onTexturePackChange: (pack: TexturePackId) => void;
  onRegenerateSquarePack: () => void;
  onWeatherModeChange: (mode: 'auto' | 'clear' | 'rain') => void;
  skins: PlayerSkin[];
  activeSkin: PlayerSkin;
  onEquipSkin: (id: string) => void;
  onSaveSkin: (skin: PlayerSkin, equip?: boolean) => void;
  onDeleteSkin: (id: string) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  connectionStatus: ConnectionStatus;
  activeRoom: RoomInfo | null;
  remotePlayers: RemotePlayerState[];
  initialJoinCode?: string;
  onJoinRoom: (roomId: string) => void;
  onHostRoom: (opts: {
    roomId: string;
    name: string;
    seed: string;
    worldType: WorldType;
    mode: GameMode;
    copyCurrentWorld?: boolean;
  }) => void;
  onDisconnectMultiplayer: () => void;
  voiceState: VoiceStateSnapshot;
  onToggleVoice: () => void;
  onLeaveVoice: () => void;
  onVoiceSpatialModeChange: (mode: VoiceSpatialMode) => void;
  mineDollars: bigint;
  ownedMarketplaceIds: string[];
  activeBehaviorPacks: BehaviorPackId[];
  onBuyMarketplaceItem: (item: MarketplaceItem) => void;
  onEquipResourcePack: (packId: TexturePackId) => void;
  onToggleBehaviorPack: (packId: BehaviorPackId) => void;
  onEquipSkinFromMarketplace: (skinItem: MarketplaceSkinItem) => void;
  onLaunchMarketplaceWorld: (bundle: MarketplaceBundleItem) => void;
  onClaimBonusMineDollars: () => void;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  variant,
  hud,
  selectedMode,
  seedInput,
  savedWorlds,
  activeWorldId,
  muted,
  renderDistance,
  sensitivity,
  fov,
  texturePack,
  weatherMode,
  onSelectMode,
  onSeedChange,
  onStartWorld,
  onPlayOneBlock,
  onPlaySkyblock,
  onPlayTutorial,
  onPlayParkour,
  onPlayParkour100,
  onPlayWouldYouRather,
  twoPlayerMode,
  onToggleTwoPlayerMode,
  onLoadWorld,
  onCreateWorld,
  onDeleteWorld,
  onRenameWorld,
  onResume,
  onReturnTitle,
  onToggleMute,
  onRenderDistanceChange,
  onSensitivityChange,
  onFovChange,
  onTimeOfDayChange,
  onTexturePackChange,
  onRegenerateSquarePack,
  onWeatherModeChange,
  skins,
  activeSkin,
  onEquipSkin,
  onSaveSkin,
  onDeleteSkin,
  playerName,
  onPlayerNameChange,
  connectionStatus,
  activeRoom,
  remotePlayers,
  initialJoinCode,
  onJoinRoom,
  onHostRoom,
  onDisconnectMultiplayer,
  voiceState,
  onToggleVoice,
  onLeaveVoice,
  onVoiceSpatialModeChange,
  mineDollars,
  ownedMarketplaceIds,
  activeBehaviorPacks,
  onBuyMarketplaceItem,
  onEquipResourcePack,
  onToggleBehaviorPack,
  onEquipSkinFromMarketplace,
  onLaunchMarketplaceWorld,
  onClaimBonusMineDollars,
}) => {
  const [tab, setTab] = useState<MenuTab>(() => (initialJoinCode ? 'multiplayer' : 'home'));
  const [newWorldName, setNewWorldName] = useState(() => `World ${savedWorlds.length + 1}`);
  const [newWorldSeed, setNewWorldSeed] = useState(() => `world-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newWorldMode, setNewWorldMode] = useState<GameMode>('survival');
  const [newWorldType, setNewWorldType] = useState<WorldType>('normal');
  const [showCreateForm, setShowCreateForm] = useState(savedWorlds.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuCardRef = useRef<HTMLDivElement | null>(null);

  const isTitle = variant === 'title';
  const activeMode = isTitle ? selectedMode : hud.mode;

  const randomizeNewSeed = () => {
    setNewWorldSeed(`world-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const openWorldsTab = (createMode = false) => {
    setNewWorldName(`World ${savedWorlds.length + 1}`);
    setShowCreateForm(createMode || savedWorlds.length === 0);
    setConfirmDeleteId(null);
    setEditingId(null);
    setTab('worlds');
  };

  return (
    <div
      className={`fixed inset-0 z-30 flex flex-col justify-between overflow-y-auto p-3 sm:p-5 ${
        isTitle
          ? 'bg-gradient-to-b from-[#0b0505]/75 via-[#140706]/30 to-[#1f0604]/80'
          : 'bg-[#080b12]/72'
      }`}
    >
      {isTitle && <MenuFireBackdrop cardRef={menuCardRef} />}
      {isTitle && <MenuDuelCanvas variant="battlefield" cardRef={menuCardRef} />}

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div
          className={`flex items-center gap-2 rounded-none px-3 py-1.5 text-xs font-medium text-slate-100 shadow-lg ${
            isTitle
              ? 'border border-orange-500/40 bg-[#180c0a]/92 shadow-[0_0_16px_rgba(249,115,22,0.25)]'
              : 'border border-white/15 bg-[#121722]/92'
          }`}
        >
          {isTitle ? (
            <>
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>MINECRAFT PLAY · {hud.worldName}</span>
            </>
          ) : (
            <>
              <span className="font-bold text-white">{hud.worldName}</span>
              <span className="text-white/25">|</span>
              <span className="font-bold text-emerald-300">{hud.biome}</span>
              <span className="text-white/25">|</span>
              <span className="tabular-nums text-amber-300">Day {hud.dayCount}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('marketplace')}
            className="flex items-center gap-1.5 rounded-none border border-amber-400/40 bg-[#181611]/92 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-lg transition hover:border-amber-300 hover:bg-[#242014]"
            title={`${formatMineDollarsExact(mineDollars)} MineDollars — Open Marketplace`}
          >
            <Coins className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono">{formatMineDollarsCompact(mineDollars)} MD</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-1.5 rounded-none border border-white/15 bg-[#121722]/92 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg transition hover:bg-[#1d2434]"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </div>

      {/* Center Menu Container */}
      <div
        className={`relative z-10 mx-auto my-auto flex w-full flex-col items-center gap-2 ${
          tab === 'marketplace'
            ? 'max-w-4xl'
            : tab === 'skins'
              ? 'max-w-3xl'
              : tab === 'worlds' || tab === 'multiplayer'
                ? 'max-w-lg'
                : 'max-w-md'
        }`}
      >
        {isTitle && tab === 'home' && (
          <div className="flex w-full flex-col items-center gap-1 text-center">
            <div className="relative flex items-center justify-center">
              <div
                className="pointer-events-none absolute h-14 w-14 bg-orange-500/35 blur-xl"
                aria-hidden="true"
              />
              <svg
                width="46"
                height="46"
                viewBox="0 0 32 32"
                className="relative drop-shadow-[0_0_18px_rgba(249,115,22,0.85)]"
                aria-hidden="true"
              >
                <polygon points="16,2 30,9 16,16 2,9" fill="#f97316" />
                <polygon points="16,4 27,9.5 16,15 5,9.5" fill="#fbbf24" />
                <polygon points="2,9 16,16 16,30 2,23" fill="#2d1614" />
                <polygon points="2,9 16,16 16,19.5 2,12.5" fill="#ea580c" />
                <polygon points="30,9 16,16 16,30 30,23" fill="#1b0d0c" />
                <polygon points="30,9 16,16 16,19.5 30,12.5" fill="#c2410c" />
              </svg>
            </div>
            <h1 className="bg-gradient-to-b from-[#fffbeb] via-[#fbbf24] to-[#ea580c] bg-clip-text text-4xl font-black tracking-[0.14em] text-transparent drop-shadow-[0_6px_22px_rgba(234,88,12,0.75)] sm:text-5xl">
              MINECRAFT PLAY
            </h1>
            <p className="max-w-sm text-xs font-medium text-amber-100/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              Forge endless worlds, tame and battle wildlife, craft gear, and conquer volcanic &amp; sky biomes.
            </p>
            <div className="pointer-events-none relative z-20 -mb-2.5 h-[98px] w-[min(92vw,680px)]">
              <MenuDuelCanvas variant="card" />
            </div>
          </div>
        )}

        {/* Menu Card */}
        <div
          ref={menuCardRef}
          className={`flex w-full flex-col gap-2.5 rounded-none p-4 sm:p-5 ${
            isTitle
              ? 'border-2 border-orange-500/70 bg-[#140b0b]/94 shadow-[0_0_48px_rgba(249,115,22,0.45),inset_0_0_24px_rgba(234,88,12,0.16)]'
              : 'border-2 border-[#353d4d] bg-[#141922]/96 shadow-2xl'
          }`}
        >
          {/* Sub-screen header when not on home */}
          {tab !== 'home' ? (
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <button
                type="button"
                onClick={() => setTab('home')}
                className="flex items-center gap-1.5 rounded-none bg-[#1e2533] px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-[#2a3346]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">
                {tab === 'worlds' && `Worlds (${savedWorlds.length})`}
                {tab === 'multiplayer' && 'Multiplayer Servers'}
                {tab === 'skins' && 'Skin Maker & Wardrobe'}
                {tab === 'marketplace' && 'Marketplace & Packs'}
                {tab === 'settings' && 'Menu Settings'}
                {tab === 'controls' && 'Controls & Guide'}
              </h2>
              <div className="w-14" />
            </div>
          ) : (
            !isTitle && (
              <div className="flex flex-col gap-2 border-b border-white/10 pb-3">
                <div className="text-center">
                  <h2 className="text-lg font-extrabold tracking-widest text-white uppercase">
                    Game Menu
                  </h2>
                  <div className="text-[11px] font-medium text-slate-400">
                    {hud.worldName} · Seed <span className="font-mono text-slate-300">{hud.worldId ? seedInput : 'default'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-none bg-[#0d1118] p-2 text-center text-[11px]">
                  <div>
                    <div className="text-slate-400">Mined</div>
                    <div className="tabular-nums font-bold text-amber-300">{hud.blocksMined}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Placed</div>
                    <div className="tabular-nums font-bold text-sky-300">{hud.blocksPlaced}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Mobs</div>
                    <div className="tabular-nums font-bold text-emerald-300">{hud.mobsDefeated}</div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* HOME MENU VIEW */}
          {tab === 'home' && (
            <div className="flex flex-col gap-2.5">
              {isTitle ? (
                <>
                  <button
                    type="button"
                    onClick={() => onStartWorld(selectedMode, seedInput)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-none border-b-4 border-red-900 bg-gradient-to-b from-amber-300 via-orange-500 to-red-600 py-3.5 text-xl font-black tracking-[0.2em] text-slate-950 uppercase shadow-[0_0_26px_rgba(249,115,22,0.55)] transition hover:from-amber-200 hover:via-orange-400 hover:to-red-500 active:translate-y-0.5"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Play
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPlayOneBlock(selectedMode)}
                      className="flex items-center justify-center gap-1 rounded-none border border-emerald-400/60 bg-gradient-to-r from-emerald-500/25 to-teal-500/20 py-2 text-[11px] font-black tracking-wider text-emerald-200 uppercase transition hover:border-emerald-300 hover:from-emerald-500/35 hover:to-teal-500/30"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                      One Block
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlayParkour100(selectedMode)}
                      className="flex items-center justify-center gap-1 rounded-none border border-rose-400/50 bg-gradient-to-r from-fuchsia-500/20 to-amber-500/20 py-2 text-[11px] font-black tracking-wider text-amber-200 uppercase transition hover:border-amber-300 hover:from-fuchsia-500/30 hover:to-amber-500/30"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-300" />
                      100-Lvl Parkour
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPlayWouldYouRather(selectedMode)}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-400/60 bg-gradient-to-r from-emerald-500/20 via-amber-500/15 to-amber-500/25 py-2 text-[11px] font-black tracking-wider text-amber-100 uppercase transition hover:border-amber-300 hover:from-emerald-500/30 hover:to-amber-500/35"
                  >
                    <Compass className="h-3.5 w-3.5 text-emerald-300" />
                    Would You Rather · 100 Levels
                  </button>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPlayParkour(selectedMode)}
                      className="flex items-center justify-center gap-1 rounded-none border border-fuchsia-400/40 bg-fuchsia-500/15 py-2 text-[11px] font-extrabold tracking-wider text-fuchsia-200 uppercase transition hover:border-fuchsia-300/70 hover:bg-fuchsia-500/25"
                    >
                      <Zap className="h-3.5 w-3.5 text-fuchsia-300" />
                      Parkour
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlaySkyblock(selectedMode)}
                      className="flex items-center justify-center gap-1 rounded-none border border-sky-400/40 bg-sky-500/15 py-2 text-[11px] font-extrabold tracking-wider text-sky-200 uppercase transition hover:border-sky-300/70 hover:bg-sky-500/25"
                    >
                      <Globe className="h-3.5 w-3.5 text-sky-300" />
                      Skyblock
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlayTutorial(selectedMode)}
                      className="flex items-center justify-center gap-1 rounded-none border border-amber-400/40 bg-amber-500/15 py-2 text-[11px] font-extrabold tracking-wider text-amber-200 uppercase transition hover:border-amber-300/70 hover:bg-amber-500/25"
                    >
                      <Compass className="h-3.5 w-3.5 text-amber-300" />
                      Tutorial
                    </button>
                  </div>

                  {/* Mode Switcher */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectMode('survival')}
                      className={`flex items-center justify-center gap-1.5 rounded-none border px-2 py-2 text-xs font-bold transition ${
                        selectedMode === 'survival'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Survival
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMode('creative')}
                      className={`flex items-center justify-center gap-1.5 rounded-none border px-2 py-2 text-xs font-bold transition ${
                        selectedMode === 'creative'
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Creative
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMode('hardcore')}
                      title="1 Life · Tougher Mobs · Permadeath"
                      className={`flex items-center justify-center gap-1.5 rounded-none border px-2 py-2 text-xs font-bold transition ${
                        selectedMode === 'hardcore'
                          ? 'border-rose-500 bg-rose-600/25 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.28)]'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-rose-400/40 hover:text-rose-200'
                      }`}
                    >
                      <Skull className="h-3.5 w-3.5 text-rose-400" />
                      Hardcore
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleTwoPlayerMode}
                    className={`flex w-full items-center justify-between rounded-none border px-3 py-2 text-xs font-bold transition ${
                      twoPlayerMode
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.28)]'
                        : 'border-white/12 bg-[#1c222e] text-slate-300 hover:border-cyan-400/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-300" />
                      2-Player Split-Screen
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-black uppercase ${
                        twoPlayerMode ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {twoPlayerMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onResume}
                    className="flex w-full items-center justify-center gap-2 rounded-none border-b-4 border-emerald-700 bg-emerald-500 py-2.5 text-sm font-extrabold tracking-wider text-slate-950 uppercase transition hover:bg-emerald-400 active:translate-y-0.5"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Resume Game
                  </button>

                  {/* Quick Mode Toggle */}
                  {activeMode === 'hardcore' ? (
                    <div className="flex items-center justify-center gap-2 rounded-none border border-rose-500/50 bg-rose-950/50 py-2 text-xs font-extrabold tracking-wider text-rose-200 uppercase">
                      <Skull className="h-3.5 w-3.5 text-rose-400" />
                      {hud.spectating ? 'Hardcore · Spectating Fallen World' : 'Hardcore Mode Locked (1 Life)'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectMode('survival')}
                        className={`flex items-center justify-center gap-1.5 rounded-none border py-2 text-xs font-bold transition ${
                          activeMode === 'survival'
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Survival
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectMode('creative')}
                        className={`flex items-center justify-center gap-1.5 rounded-none border py-2 text-xs font-bold transition ${
                          activeMode === 'creative'
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Creative
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onToggleTwoPlayerMode}
                    className={`flex w-full items-center justify-between rounded-none border px-3 py-2 text-xs font-bold transition ${
                      twoPlayerMode
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/12 bg-[#1c222e] text-slate-300 hover:border-cyan-400/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-300" />
                      2-Player Split-Screen
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-black uppercase ${
                        twoPlayerMode ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {twoPlayerMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openWorldsTab(false)}
                  className="flex items-center justify-center gap-1.5 rounded-none border border-white/12 bg-[#1c222e] py-2.5 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-[#252d3d]"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
                  My Worlds ({savedWorlds.length})
                </button>
                <button
                  type="button"
                  onClick={() => openWorldsTab(true)}
                  className="flex items-center justify-center gap-1.5 rounded-none border border-emerald-400/25 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-300" />
                  New World
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab('multiplayer')}
                  className="flex items-center justify-between rounded-none border border-cyan-400/40 bg-cyan-500/12 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/20"
                >
                  <span className="flex items-center gap-1.5">
                    {connectionStatus === 'connected' ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-cyan-300" />
                    )}
                    <span>Multiplayer</span>
                  </span>
                  <span className="text-[10px] font-semibold text-cyan-200/80">
                    {connectionStatus === 'connected' && activeRoom
                      ? `${remotePlayers.length + 1} online`
                      : 'Co-op'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('skins')}
                  className="flex items-center justify-between rounded-none border border-purple-400/35 bg-purple-500/12 px-3 py-2 text-xs font-bold text-purple-100 transition hover:border-purple-300/60 hover:bg-purple-500/20"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <img
                      src={renderSkinFaceDataUrl(activeSkin)}
                      alt={activeSkin.name}
                      className="pixelated h-4 w-4 shrink-0 border border-white/25"
                    />
                    <span className="truncate">Skin Maker</span>
                  </span>
                  <Palette className="h-3.5 w-3.5 shrink-0 text-purple-300" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setTab('marketplace')}
                className="flex items-center justify-between rounded-none border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-400/12 to-emerald-500/15 px-3 py-2 text-xs font-extrabold text-amber-100 transition hover:border-amber-300 hover:from-amber-500/30 hover:to-emerald-500/25"
              >
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-300" />
                  <span className="tracking-wide uppercase">Marketplace</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-300">
                  <Coins className="h-3.5 w-3.5" />
                  {formatMineDollarsCompact(mineDollars)} MD
                </span>
              </button>

              <button
                type="button"
                onClick={onClaimBonusMineDollars}
                title={`+${formatMineDollarsExact(BONUS_MINEDOLLARS)} MineDollars`}
                className="flex items-center justify-center gap-2 rounded-none border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-[11px] font-black tracking-wide text-amber-200 uppercase transition hover:border-amber-300 hover:bg-amber-400/30 active:translate-y-0.5"
              >
                <Coins className="h-3.5 w-3.5 text-amber-300" />
                + Get {formatMineDollarsCompact(BONUS_MINEDOLLARS)} MD
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab('settings')}
                  className="flex items-center justify-center gap-1.5 rounded-none border border-white/12 bg-[#1c222e] py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-[#252d3d]"
                >
                  <Settings className="h-3.5 w-3.5 text-emerald-300" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => setTab('controls')}
                  className="flex items-center justify-center gap-1.5 rounded-none border border-white/12 bg-[#1c222e] py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-[#252d3d]"
                >
                  <Gamepad2 className="h-3.5 w-3.5 text-amber-300" />
                  Controls &amp; Mobs
                </button>
              </div>

              {!isTitle && (
                <button
                  type="button"
                  onClick={() => {
                    setTab('home');
                    onReturnTitle();
                  }}
                  className="mt-1 w-full rounded-none border border-white/10 bg-[#11151d] py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200"
                >
                  Save &amp; Return to Main Menu
                </button>
              )}
            </div>
          )}

          {/* MULTIPLAYER LOBBY VIEW */}
          {tab === 'multiplayer' && (
            <MultiplayerPanel
              playerName={playerName}
              onPlayerNameChange={onPlayerNameChange}
              activeSkin={activeSkin}
              connectionStatus={connectionStatus}
              activeRoom={activeRoom}
              remotePlayers={remotePlayers}
              initialJoinCode={initialJoinCode}
              onJoinRoom={(roomId) => {
                setTab('home');
                onJoinRoom(roomId);
              }}
              onHostRoom={(opts) => {
                setTab('home');
                onHostRoom(opts);
              }}
              onDisconnect={onDisconnectMultiplayer}
              voiceState={voiceState}
              onToggleVoice={onToggleVoice}
              onLeaveVoice={onLeaveVoice}
              onVoiceSpatialModeChange={onVoiceSpatialModeChange}
            />
          )}

          {/* SKIN MAKER VIEW */}
          {tab === 'skins' && (
            <SkinMakerPanel
              skins={skins}
              activeSkinId={activeSkin.id}
              onEquipSkin={onEquipSkin}
              onSaveSkin={onSaveSkin}
              onDeleteSkin={onDeleteSkin}
            />
          )}

          {/* MARKETPLACE VIEW */}
          {tab === 'marketplace' && (
            <MarketplacePanel
              balance={mineDollars}
              ownedIds={ownedMarketplaceIds}
              activeResourcePack={texturePack}
              activeBehaviorPacks={activeBehaviorPacks}
              activeSkinId={activeSkin.id}
              onBuyItem={onBuyMarketplaceItem}
              onEquipResourcePack={onEquipResourcePack}
              onToggleBehaviorPack={onToggleBehaviorPack}
              onEquipSkinFromMarketplace={onEquipSkinFromMarketplace}
              onLaunchMarketplaceWorld={(bundle) => {
                setTab('home');
                onLaunchMarketplaceWorld(bundle);
              }}
              onClaimBonusMineDollars={onClaimBonusMineDollars}
            />
          )}

          {/* WORLDS MANAGER & CREATOR VIEW */}
          {tab === 'worlds' && (
            <div className="flex flex-col gap-3">
              {/* Switch between Saved List and New World Creator */}
              <div className="grid grid-cols-2 gap-1.5 rounded-none bg-[#0c1017] p-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className={`flex items-center justify-center gap-1.5 rounded-none py-1.5 text-xs font-bold transition ${
                    !showCreateForm
                      ? 'bg-[#212938] text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5 text-sky-300" />
                  Saved Worlds ({savedWorlds.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewWorldName(`World ${savedWorlds.length + 1}`);
                    setShowCreateForm(true);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-none py-1.5 text-xs font-bold transition ${
                    showCreateForm
                      ? 'bg-emerald-500/20 text-emerald-200 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-300" />
                  Create New World
                </button>
              </div>

              {!showCreateForm ? (
                <div className="flex flex-col gap-2">
                  {savedWorlds.length === 0 ? (
                    <div className="rounded-none border border-dashed border-white/15 bg-[#0d1118] p-5 text-center text-xs text-slate-400">
                      No saved worlds yet. Create your first world to save your builds and inventory.
                    </div>
                  ) : (
                    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                      {savedWorlds.map((w) => {
                        const isActive = w.id === activeWorldId;
                        const isEditing = editingId === w.id;
                        const isDeleting = confirmDeleteId === w.id;
                        return (
                          <div
                            key={w.id}
                            className={`flex flex-col gap-1.5 rounded-none border p-2.5 transition ${
                              isActive
                                ? 'border-emerald-400/50 bg-emerald-950/20'
                                : 'border-white/10 bg-[#181e29] hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              {isEditing ? (
                                <div className="flex flex-1 items-center gap-1">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    maxLength={28}
                                    autoFocus
                                    className="w-full rounded-none border border-emerald-400/60 bg-[#0b0e14] px-2 py-0.5 text-xs font-bold text-white outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingName.trim()) {
                                        onRenameWorld(w.id, editingName.trim());
                                      }
                                      setEditingId(null);
                                    }}
                                    className="rounded-none bg-emerald-500/25 p-1 text-emerald-300 hover:bg-emerald-500/40"
                                    title="Save Name"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded-none bg-white/10 p-1 text-slate-300 hover:bg-white/20"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-xs font-bold text-white">
                                    {w.name}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded-none px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                      w.mode === 'creative'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : w.mode === 'hardcore'
                                          ? 'bg-rose-500/25 text-rose-300'
                                          : 'bg-emerald-500/20 text-emerald-300'
                                    }`}
                                  >
                                    {w.mode}
                                  </span>
                                  {w.mode === 'hardcore' && w.hardcoreDead && (
                                    <span className="shrink-0 rounded-none bg-rose-900/70 px-1.5 py-0.5 text-[10px] font-black uppercase text-rose-200">
                                      Lost
                                    </span>
                                  )}
                                  {(w.worldType === 'oneblock' || w.seed.toLowerCase().startsWith('oneblock')) && (
                                    <span className="shrink-0 rounded-none bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-200">
                                      One Block
                                    </span>
                                  )}
                                  {(w.worldType === 'skyblock' || w.seed.toLowerCase().startsWith('skyblock')) && (
                                    <span className="shrink-0 rounded-none bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                                      Skyblock
                                    </span>
                                  )}
                                  {(w.worldType === 'tutorial' || w.seed.toLowerCase().startsWith('tutorial')) && (
                                    <span className="shrink-0 rounded-none bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                                      Tutorial
                                    </span>
                                  )}
                                  {(w.worldType === 'parkour100' || w.seed.toLowerCase().startsWith('parkour100')) && (
                                    <span className="shrink-0 rounded-none bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                                      100-Lvl Parkour
                                    </span>
                                  )}
                                  {(w.worldType === 'wouldyourather' ||
                                    w.seed.toLowerCase().startsWith('wyr100') ||
                                    w.seed.toLowerCase().startsWith('wouldyourather')) && (
                                    <span className="shrink-0 rounded-none bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-200">
                                      WYR 100
                                    </span>
                                  )}
                                  {w.worldType !== 'parkour100' &&
                                    !w.seed.toLowerCase().startsWith('parkour100') &&
                                    (w.worldType === 'parkour' || w.seed.toLowerCase().startsWith('parkour')) && (
                                      <span className="shrink-0 rounded-none bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-fuchsia-200">
                                        Parkour
                                      </span>
                                    )}
                                  {isActive && (
                                    <span className="shrink-0 rounded-none bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                                      Active
                                    </span>
                                  )}
                                </div>
                              )}

                              {!isEditing && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTab('home');
                                      onLoadWorld(w);
                                    }}
                                    className={`flex items-center gap-1 rounded-none px-2.5 py-1 text-[11px] font-extrabold ${
                                      w.mode === 'hardcore' && w.hardcoreDead
                                        ? 'bg-rose-500/80 text-white hover:bg-rose-400'
                                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                    }`}
                                  >
                                    <Play className="h-3 w-3 fill-current" />
                                    {w.mode === 'hardcore' && w.hardcoreDead ? 'Spectate' : 'Play'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(w.id);
                                      setEditingName(w.name);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="rounded-none border border-white/10 bg-[#121620] p-1 text-slate-300 hover:border-white/30 hover:text-white"
                                    title="Rename World"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {isDeleting ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteWorld(w.id);
                                          setConfirmDeleteId(null);
                                        }}
                                        className="rounded-none bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-400"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="rounded-none bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(w.id)}
                                      className="rounded-none border border-white/10 bg-[#121620] p-1 text-slate-400 hover:border-rose-400/40 hover:text-rose-300"
                                      title="Delete World"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                              <span className="font-mono text-slate-300">Seed: {w.seed}</span>
                              <span>Day {w.dayCount}</span>
                              <span>{w.modifiedBlocks.length} block edits</span>
                              <span>{w.mobsDefeated} mobs</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setNewWorldName(`World ${savedWorlds.length + 1}`);
                      setShowCreateForm(true);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-none border-b-4 border-emerald-700 bg-emerald-500 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    Create Another World
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      World Name
                    </label>
                    <input
                      type="text"
                      value={newWorldName}
                      onChange={(e) => setNewWorldName(e.target.value)}
                      maxLength={28}
                      placeholder="My Survival Kingdom"
                      className="w-full rounded-none border border-white/15 bg-[#0c1017] px-3 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewWorldMode('survival')}
                      className={`flex items-center justify-center gap-1.5 rounded-none border py-2 text-xs font-bold transition ${
                        newWorldMode === 'survival'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Survival
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWorldMode('creative')}
                      className={`flex items-center justify-center gap-1.5 rounded-none border py-2 text-xs font-bold transition ${
                        newWorldMode === 'creative'
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Creative
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWorldMode('hardcore')}
                      title="1 Life · Tougher Mobs · Permadeath"
                      className={`flex items-center justify-center gap-1.5 rounded-none border py-2 text-xs font-bold transition ${
                        newWorldMode === 'hardcore'
                          ? 'border-rose-500 bg-rose-600/25 text-rose-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-rose-400/40'
                      }`}
                    >
                      <Skull className="h-3.5 w-3.5 text-rose-400" />
                      Hardcore
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setNewWorldType('normal')}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'normal'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      Infinite
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('oneblock');
                        setNewWorldSeed('oneblock-sky-1');
                        if (newWorldName.startsWith('World ') || newWorldName === 'Skyblock Island' || newWorldName === 'Tutorial World' || newWorldName === 'Parkour Course' || newWorldName === '100-Level Parkour') {
                          setNewWorldName('One Block Challenge');
                        }
                      }}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'oneblock'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      One Block
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('skyblock');
                        if (newWorldName.startsWith('World ') || newWorldName === 'One Block Challenge' || newWorldName === 'Tutorial World' || newWorldName === 'Parkour Course' || newWorldName === '100-Level Parkour') {
                          setNewWorldName('Skyblock Island');
                        }
                      }}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'skyblock'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      Skyblock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('parkour');
                        if (newWorldName.startsWith('World ') || newWorldName === 'One Block Challenge' || newWorldName === 'Skyblock Island' || newWorldName === 'Tutorial World' || newWorldName === '100-Level Parkour') {
                          setNewWorldName('Parkour Course');
                        }
                      }}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'parkour'
                          ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      Parkour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('parkour100');
                        setNewWorldSeed('parkour100-mega-1');
                        if (newWorldName.startsWith('World ') || newWorldName === 'One Block Challenge' || newWorldName === 'Skyblock Island' || newWorldName === 'Tutorial World' || newWorldName === 'Parkour Course') {
                          setNewWorldName('100-Level Parkour');
                        }
                      }}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'parkour100'
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      100-Lvl
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('tutorial');
                        if (newWorldName.startsWith('World ') || newWorldName === 'One Block Challenge' || newWorldName === 'Skyblock Island' || newWorldName === 'Parkour Course' || newWorldName === '100-Level Parkour' || newWorldName === '100-Level Would You Rather') {
                          setNewWorldName('Tutorial World');
                        }
                      }}
                      className={`flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'tutorial'
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      Tutorial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewWorldType('wouldyourather');
                        setNewWorldSeed('wyr100-mega-1');
                        if (newWorldName.startsWith('World ') || newWorldName === 'One Block Challenge' || newWorldName === 'Skyblock Island' || newWorldName === 'Tutorial World' || newWorldName === 'Parkour Course' || newWorldName === '100-Level Parkour') {
                          setNewWorldName('100-Level Would You Rather');
                        }
                      }}
                      className={`col-span-3 flex items-center justify-center rounded-none border py-1.5 text-[10px] font-bold transition ${
                        newWorldType === 'wouldyourather'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/10 bg-[#1c222e] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      Would You Rather (100 Levels)
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      World Seed
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newWorldSeed}
                        onChange={(e) => setNewWorldSeed(e.target.value)}
                        placeholder="Enter seed..."
                        className="w-full rounded-none border border-white/15 bg-[#0c1017] px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400"
                      />
                      <button
                        type="button"
                        onClick={randomizeNewSeed}
                        className="flex shrink-0 items-center gap-1 rounded-none border border-white/15 bg-[#1e2533] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-[#293245]"
                        title="Random Seed"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Random
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Scenic Biome &amp; Map Presets
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_WORLDS.map((preset) => (
                        <button
                          key={preset.seed}
                          type="button"
                          onClick={() => {
                            setNewWorldSeed(preset.seed);
                            setNewWorldType(preset.worldType ?? 'normal');
                            if (newWorldName.startsWith('World ') || newWorldName === 'Skyblock Island') {
                              setNewWorldName(preset.label);
                            }
                            onSeedChange(preset.seed);
                          }}
                          className={`flex flex-col items-start rounded-none border px-2.5 py-1.5 text-left transition ${
                            newWorldSeed === preset.seed
                              ? 'border-emerald-400 bg-emerald-500/15'
                              : 'border-white/10 bg-[#1a202c] hover:border-white/25'
                          }`}
                        >
                          <span className="text-xs font-bold text-white">{preset.label}</span>
                          <span className="text-[10px] text-slate-400">{preset.tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cleanName = newWorldName.trim() || `World ${savedWorlds.length + 1}`;
                      const cleanSeed = newWorldSeed.trim() || `world-${Math.floor(1000 + Math.random() * 9000)}`;
                      setTab('home');
                      onCreateWorld(cleanName, newWorldMode, cleanSeed, newWorldType);
                    }}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-none border-b-4 border-emerald-700 bg-emerald-500 py-2.5 text-sm font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    Create &amp; Enter World
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS VIEW */}
          {tab === 'settings' && (
            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Texture Pack</span>
                  <button
                    type="button"
                    onClick={onRegenerateSquarePack}
                    className="flex items-center gap-1 rounded-none border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                    title="Re-roll 16x16 procedural square voxel noise"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Re-roll 16px
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onTexturePackChange('square')}
                    className={`rounded-none border py-1.5 text-[11px] font-bold transition ${
                      texturePack === 'square'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-white/10 bg-[#1a202c] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    Square 16px Pack
                  </button>
                  <button
                    type="button"
                    onClick={() => onTexturePackChange('pbr')}
                    className={`rounded-none border py-1.5 text-[11px] font-bold transition ${
                      texturePack === 'pbr'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-[#1a202c] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    Ultra PBR 128px
                  </button>
                </div>
                {MARKETPLACE_RESOURCE_PACKS.filter(
                  (rp) => rp.price > 0n && ownedMarketplaceIds.includes(rp.id)
                ).length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {MARKETPLACE_RESOURCE_PACKS.filter(
                      (rp) => rp.price > 0n && ownedMarketplaceIds.includes(rp.id)
                    ).map((rp) => (
                      <button
                        key={rp.id}
                        type="button"
                        onClick={() => onTexturePackChange(rp.packId)}
                        className={`rounded-none border py-1.5 text-[11px] font-bold transition ${
                          texturePack === rp.packId
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                            : 'border-white/10 bg-[#1a202c] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        {rp.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                    Render Distance
                  </span>
                  <span className="tabular-nums font-mono text-emerald-300">{renderDistance} chunks</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={7}
                  value={renderDistance}
                  onChange={(e) => onRenderDistanceChange(Number(e.target.value))}
                  className="accent-emerald-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Field of View (FOV)</span>
                  <span className="tabular-nums font-mono text-emerald-300">{fov}°</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={100}
                  value={fov}
                  onChange={(e) => onFovChange(Number(e.target.value))}
                  className="accent-emerald-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Mouse Sensitivity</span>
                  <span className="tabular-nums font-mono text-emerald-300">{sensitivity}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={45}
                  value={sensitivity}
                  onChange={(e) => onSensitivityChange(Number(e.target.value))}
                  className="accent-emerald-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-slate-300">Atmosphere / Time of Day</span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onTimeOfDayChange(0.04)}
                    className="flex flex-col items-center gap-1 rounded-none border border-white/10 bg-[#1a202c] py-1.5 text-[10px] font-semibold text-amber-200 hover:border-amber-300/50"
                  >
                    <Sunrise className="h-3.5 w-3.5" />
                    Dawn
                  </button>
                  <button
                    type="button"
                    onClick={() => onTimeOfDayChange(0.25)}
                    className="flex flex-col items-center gap-1 rounded-none border border-white/10 bg-[#1a202c] py-1.5 text-[10px] font-semibold text-sky-200 hover:border-sky-300/50"
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Noon
                  </button>
                  <button
                    type="button"
                    onClick={() => onTimeOfDayChange(0.49)}
                    className="flex flex-col items-center gap-1 rounded-none border border-white/10 bg-[#1a202c] py-1.5 text-[10px] font-semibold text-orange-300 hover:border-orange-300/50"
                  >
                    <Sunset className="h-3.5 w-3.5" />
                    Sunset
                  </button>
                  <button
                    type="button"
                    onClick={() => onTimeOfDayChange(0.75)}
                    className="flex flex-col items-center gap-1 rounded-none border border-white/10 bg-[#1a202c] py-1.5 text-[10px] font-semibold text-indigo-200 hover:border-indigo-300/50"
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Night
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-slate-300">Weather</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['auto', 'clear', 'rain'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onWeatherModeChange(w)}
                      className={`rounded-none border py-1.5 text-[11px] font-bold uppercase transition ${
                        weatherMode === w
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-white/10 bg-[#1a202c] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {w === 'auto' ? 'Natural' : w === 'clear' ? 'Clear Sky' : 'Rain'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="text-slate-300">Sound Effects</span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="flex items-center gap-1.5 rounded-none bg-[#1e2430] px-3 py-1.5 font-semibold text-slate-200 hover:bg-[#2a3242]"
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {muted ? 'Muted' : 'Enabled'}
                </button>
              </div>
            </div>
          )}

          {/* CONTROLS & MOBS GUIDE VIEW */}
          {tab === 'controls' && (
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['WASD', 'Move'],
                  ['Space', 'Jump / Double-Fly'],
                  ['Shift', 'Sneak / Descend'],
                  ['Left Click', 'Mine / Attack'],
                  ['Right Click', 'Place / Eat / Use'],
                  ['1 – 9 / Scroll', 'Select Hotbar'],
                  ['E', 'Inventory & Craft'],
                  ['Q', 'Drop Item'],
                  ['R', 'Parkour Checkpoint'],
                  ['T', 'Multiplayer Chat'],
                  ['V', 'Voice Mic / Mute'],
                  ['M', 'Switch Mode'],
                  ['Esc', 'Open Menu'],
                ].map(([key, action]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-none border border-white/10 bg-[#0d1118] px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[11px] font-bold text-amber-300">{key}</span>
                    <span className="text-[11px] text-slate-300">{action}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-none border border-cyan-500/25 bg-cyan-950/30 p-2.5 text-[11px] leading-relaxed text-cyan-100">
                <strong className="text-cyan-300">2-Player Split-Screen Controls (Player 2):</strong> Arrow Keys Move · <span className="font-mono font-bold">IJKL</span> Look · <span className="font-mono font-bold">Right Shift / Numpad 0</span> Jump/Fly · <span className="font-mono font-bold">O</span> Mine/Attack · <span className="font-mono font-bold">P</span> Place/Use · <span className="font-mono font-bold">[ / ]</span> Cycle Slot
              </div>
              <div className="rounded-none border border-sky-500/25 bg-sky-950/30 p-2.5 text-[11px] leading-relaxed text-sky-100">
                <strong className="text-sky-300">World Wildlife &amp; Night Mobs:</strong> Pigs, Cows, Sheep &amp; fluttering Chickens roam sunlit biomes. Wolves are calm until provoked. At night, watch out for Zombies, Skeletons, leaping Spiders &amp; explosive Stalkers!
              </div>
              <div className="rounded-none border border-emerald-500/25 bg-emerald-950/30 p-2.5 text-[11px] leading-relaxed text-emerald-100">
                <strong className="text-emerald-300">Multi-World Auto-Save:</strong> Create as many worlds as you like from <span className="font-mono font-bold">My Worlds</span>. Your blocks, inventory, position &amp; time auto-save every 10s and on pause.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Hint Bar */}
      <div className="relative z-10 text-center text-xs font-medium tracking-wide text-slate-100">
        <span
          className={
            isTitle
              ? 'inline-block border border-orange-500/30 bg-[#120706]/88 px-3 py-1 text-amber-100 shadow-lg'
              : 'drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]'
          }
        >
          WASD Move · Space Jump · Left Click Mine · Right Click Place · E Crafting · Esc Menu
        </span>
      </div>
    </div>
  );
};
