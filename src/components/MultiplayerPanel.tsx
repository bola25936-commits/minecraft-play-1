import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';
import {
  ConnectionStatus,
  fetchActiveRooms,
  generateRoomCode,
  RemotePlayerState,
  RoomInfo,
  RoomSummary,
} from '../game/multiplayer';
import { PlayerSkin, renderSkinFaceDataUrl } from '../game/skins';
import { GameMode, WorldType } from '../game/types';
import { VoiceSpatialMode, VoiceStateSnapshot } from '../game/voiceChat';

interface MultiplayerPanelProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  activeSkin: PlayerSkin;
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
  onDisconnect: () => void;
  voiceState: VoiceStateSnapshot;
  onToggleVoice: () => void;
  onLeaveVoice: () => void;
  onVoiceSpatialModeChange: (mode: VoiceSpatialMode) => void;
}

export const MultiplayerPanel: React.FC<MultiplayerPanelProps> = ({
  playerName,
  onPlayerNameChange,
  activeSkin,
  connectionStatus,
  activeRoom,
  remotePlayers,
  initialJoinCode = '',
  onJoinRoom,
  onHostRoom,
  onDisconnect,
  voiceState,
  onToggleVoice,
  onLeaveVoice,
  onVoiceSpatialModeChange,
}) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [hostName, setHostName] = useState(`${playerName || 'Player'}'s World`);
  const [hostWorldType, setHostWorldType] = useState<WorldType>('normal');
  const [hostMode, setHostMode] = useState<GameMode>('survival');
  const [hostSeed, setHostSeed] = useState(`mp-${Math.floor(1000 + Math.random() * 9000)}`);
  const [copiedCode, setCopiedCode] = useState(false);
  const [view, setView] = useState<'browse' | 'host'>('browse');

  const refreshRooms = async () => {
    setLoadingRooms(true);
    const list = await fetchActiveRooms();
    setRooms(list);
    setLoadingRooms(false);
  };

  useEffect(() => {
    void refreshRooms();
  }, [connectionStatus]);

  const handleCopyInvite = async (code: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      await navigator.clipboard.writeText(url.toString());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback ignored in restricted frames
    }
  };

  const isOnline = connectionStatus !== 'offline';

  return (
    <div className="flex flex-col gap-3">
      {/* Player Name Row */}
      <div className="flex items-center gap-2 border border-white/10 bg-[#0d1118] p-2.5">
        <img
          src={renderSkinFaceDataUrl(activeSkin)}
          alt={activeSkin.name}
          className="pixelated h-7 w-7 border border-white/25"
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Your Player Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            maxLength={20}
            placeholder="Enter nickname..."
            className="w-full border border-white/15 bg-[#151b26] px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* Connected Status Banner */}
      {isOnline && activeRoom && (
        <div className="flex flex-col gap-2 border border-emerald-400/40 bg-emerald-950/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                <Wifi className="h-3.5 w-3.5" />
                {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'} · {activeRoom.name}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                Room Code: <span className="font-mono font-bold text-amber-300">{activeRoom.id}</span> ·{' '}
                {remotePlayers.length + 1} online
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCopyInvite(activeRoom.id)}
                className="flex items-center gap-1 border border-white/15 bg-[#1b2332] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-emerald-400/50"
              >
                {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedCode ? 'Copied' : 'Invite'}
              </button>
              <button
                type="button"
                onClick={onDisconnect}
                className="flex items-center gap-1 border border-rose-400/35 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30"
              >
                <LogOut className="h-3 w-3" />
                Leave
              </button>
            </div>
          </div>

          {/* Voice Chat Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleVoice}
                className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold transition ${
                  !voiceState.enabled
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    : voiceState.muted
                      ? 'border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                      : 'border-emerald-400 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {voiceState.enabled && !voiceState.muted ? (
                  <Mic className={`h-3.5 w-3.5 ${voiceState.speaking ? 'animate-pulse' : ''}`} />
                ) : (
                  <MicOff className="h-3.5 w-3.5" />
                )}
                {!voiceState.enabled ? 'Join Voice Chat' : voiceState.muted ? 'Unmute Mic' : 'Mic Live (Mute)'}
              </button>
              {voiceState.enabled && (
                <button
                  type="button"
                  onClick={onLeaveVoice}
                  className="flex items-center gap-1 border border-white/15 bg-[#1b2332] px-2 py-1 text-[11px] font-semibold text-slate-300 hover:border-rose-400/40 hover:text-rose-200"
                  title="Disconnect Microphone"
                >
                  <PhoneOff className="h-3 w-3" />
                  Leave Voice
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 border border-white/10 bg-[#0d1118] p-0.5 text-[10px]">
              <Radio className="ml-1 h-3 w-3 text-cyan-300" />
              <button
                type="button"
                onClick={() => onVoiceSpatialModeChange('global')}
                className={`px-2 py-0.5 font-bold ${
                  voiceState.spatialMode === 'global' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Room Audio
              </button>
              <button
                type="button"
                onClick={() => onVoiceSpatialModeChange('spatial')}
                className={`px-2 py-0.5 font-bold ${
                  voiceState.spatialMode === 'spatial' ? 'bg-cyan-500/25 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3D Proximity
              </button>
            </div>
          </div>

          {voiceState.error && (
            <div className="border border-rose-400/40 bg-rose-950/60 px-2.5 py-1 text-[11px] text-rose-200">
              {voiceState.error}
            </div>
          )}

          {remotePlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              {remotePlayers.map((p) => (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold ${
                    p.isSpeaking
                      ? 'border-emerald-400/70 bg-emerald-950/50 text-emerald-200'
                      : 'border-white/10 bg-[#121722] text-slate-200'
                  }`}
                >
                  {p.voiceEnabled ? (
                    p.voiceMuted ? (
                      <MicOff className="h-3 w-3 text-amber-300" />
                    ) : (
                      <Mic className={`h-3 w-3 ${p.isSpeaking ? 'animate-pulse text-emerald-300' : 'text-emerald-400'}`} />
                    )
                  ) : (
                    <span className="h-1.5 w-1.5 bg-emerald-400" />
                  )}
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Switcher: Browse Rooms vs Host Room */}
      <div className="grid grid-cols-2 gap-1.5 bg-[#0c1017] p-1">
        <button
          type="button"
          onClick={() => setView('browse')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            view === 'browse' ? 'bg-[#212938] text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-sky-300" />
          Join Server / Room
        </button>
        <button
          type="button"
          onClick={() => setView('host')}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition ${
            view === 'host' ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="h-3.5 w-3.5 text-emerald-300" />
          Host New Room
        </button>
      </div>

      {view === 'browse' ? (
        <div className="flex flex-col gap-2.5">
          {/* Quick Join by Code */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="Enter Room Code (e.g. PUBLIC)..."
              className="w-full border border-white/15 bg-[#0c1017] px-3 py-1.5 font-mono text-xs text-slate-100 uppercase outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={() => onJoinRoom(joinCode.trim() || 'PUBLIC')}
              className="shrink-0 border-b-2 border-sky-700 bg-sky-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 uppercase hover:bg-sky-400"
            >
              Join
            </button>
          </div>

          {/* Live Rooms List */}
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Active Rooms ({rooms.length})</span>
            <button
              type="button"
              onClick={() => void refreshRooms()}
              className="flex items-center gap-1 text-sky-300 hover:text-sky-200"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRooms ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto pr-1">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 border border-white/10 bg-[#181e29] p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                    <span className="truncate text-xs font-bold text-white">{r.name}</span>
                    <span className="bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                      {r.id}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="uppercase">{r.mode}</span>
                    <span>·</span>
                    <span className="uppercase">{r.worldType}</span>
                    <span>·</span>
                    <span className="text-emerald-300">{r.playerCount} playing</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinRoom(r.id)}
                  className="shrink-0 bg-emerald-500 px-3 py-1 text-[11px] font-extrabold text-slate-950 uppercase hover:bg-emerald-400"
                >
                  {activeRoom?.id === r.id ? 'Rejoin' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Room Name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              maxLength={32}
              className="w-full border border-white/15 bg-[#0c1017] px-3 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setHostMode('survival')}
              className={`flex items-center justify-center gap-1 border py-1.5 text-xs font-bold ${
                hostMode === 'survival'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 bg-[#1c222e] text-slate-300'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Survival
            </button>
            <button
              type="button"
              onClick={() => setHostMode('creative')}
              className={`flex items-center justify-center gap-1 border py-1.5 text-xs font-bold ${
                hostMode === 'creative'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-[#1c222e] text-slate-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Creative
            </button>
            <button
              type="button"
              onClick={() => setHostMode('hardcore')}
              className={`flex items-center justify-center gap-1 border py-1.5 text-xs font-bold ${
                hostMode === 'hardcore'
                  ? 'border-rose-500 bg-rose-600/25 text-rose-200'
                  : 'border-white/10 bg-[#1c222e] text-slate-300'
              }`}
            >
              <Skull className="h-3.5 w-3.5 text-rose-400" />
              Hardcore
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(['normal', 'oneblock', 'wouldyourather', 'skyblock', 'tutorial', 'parkour', 'parkour100'] as WorldType[]).map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => setHostWorldType(wt)}
                className={`border py-1.5 text-[10px] font-bold capitalize ${
                  wt === 'wouldyourather' ? 'col-span-3 ' : ''
                }${
                  hostWorldType === wt
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-[#1c222e] text-slate-300'
                }`}
              >
                {wt === 'normal'
                  ? 'Infinite'
                  : wt === 'oneblock'
                    ? 'One Block'
                    : wt === 'wouldyourather'
                      ? 'Would You Rather (100 Levels)'
                      : wt === 'parkour100'
                        ? '100-Lvl Parkour'
                        : wt}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              World Seed
            </label>
            <input
              type="text"
              value={hostSeed}
              onChange={(e) => setHostSeed(e.target.value)}
              className="w-full border border-white/15 bg-[#0c1017] px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                onHostRoom({
                  roomId: generateRoomCode(),
                  name: hostName.trim() || 'Multiplayer World',
                  seed: hostSeed.trim() || 'voxel-valley-2026',
                  worldType: hostWorldType,
                  mode: hostMode,
                })
              }
              className="flex items-center justify-center gap-1.5 border-b-4 border-emerald-700 bg-emerald-500 py-2 text-xs font-extrabold text-slate-950 uppercase hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              Create Room
            </button>
            <button
              type="button"
              onClick={() =>
                onHostRoom({
                  roomId: generateRoomCode(),
                  name: hostName.trim() || 'Hosted World',
                  seed: hostSeed.trim() || 'voxel-valley-2026',
                  worldType: hostWorldType,
                  mode: hostMode,
                  copyCurrentWorld: true,
                })
              }
              className="flex items-center justify-center gap-1.5 border border-sky-400/40 bg-sky-500/15 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25"
            >
              <Globe className="h-3.5 w-3.5" />
              Host Current Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
