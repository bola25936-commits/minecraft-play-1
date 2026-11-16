import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Menu, Sun, Moon, MessageSquare, Users, Send, Mic, MicOff, Sparkles, RotateCcw } from 'lucide-react';
import { HOTBAR_SIZE } from '../game/inventory';
import { ChatMessage, ConnectionStatus, RemotePlayerState, RoomInfo } from '../game/multiplayer';
import { PlayerSkin, renderSkinFaceDataUrl } from '../game/skins';
import { BlockId, BLOCK_DEFS, HudSnapshot } from '../game/types';
import { VoiceStateSnapshot } from '../game/voiceChat';
import { WYR_VOICE_STYLE_LABELS, wyrVoiceNarrator } from '../game/wyrVoice';

interface GameHudProps {
  hud: HudSnapshot;
  activeSkin: PlayerSkin;
  muted: boolean;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onOpenInventory: () => void;
  onSelectSlot: (idx: number) => void;
  getIcon: (id: BlockId) => string;
  connectionStatus: ConnectionStatus;
  activeRoom: RoomInfo | null;
  remotePlayers: RemotePlayerState[];
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  onOpenChat: () => void;
  onCloseChat: () => void;
  onSendChat: (text: string) => void;
  voiceState: VoiceStateSnapshot;
  onToggleVoice: () => void;
}

const RAINBOW_PAIRS: [string, string, string][] = [
  ['#ff3b5c', '#ff6b4a', '#ff9f43'],
  ['#ff6b4a', '#ff9f43', '#ffd43b'],
  ['#ff9f43', '#ffd43b', '#a9e34b'],
  ['#ffd43b', '#8ce99a', '#38d9a9'],
  ['#69db7c', '#20c997', '#22b8cf'],
  ['#20c997', '#22b8cf', '#4dabf7'],
  ['#22b8cf', '#4dabf7', '#748ffc'],
  ['#4dabf7', '#7950f2', '#b197fc'],
  ['#7950f2', '#da77f2', '#f783ac'],
  ['#da77f2', '#ff4d8d', '#ff3b5c'],
];

function PixelHeart({
  state,
  index,
  hardcore,
}: {
  state: 'full' | 'half' | 'empty';
  index: number;
  hardcore?: boolean;
}) {
  const gradId = `rainbow-heart-${hardcore ? 'hc-' : ''}${index}`;
  const [c1, c2, c3] = hardcore
    ? ['#dc2626', '#991b1b', '#f43f5e']
    : RAINBOW_PAIRS[index % RAINBOW_PAIRS.length];
  return (
    <svg width="16" height="16" viewBox="0 0 9 9" className="pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="50%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </linearGradient>
      </defs>
      {/* Outline */}
      <path
        d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1V1z"
        fill="#141414"
      />
      {/* Empty inner */}
      <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z" fill={hardcore ? '#2c1218' : '#3a282b'} />
      {state === 'full' && (
        <>
          <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z" fill={`url(#${gradId})`} />
          {hardcore ? (
            <>
              <rect x="2" y="3" width="1" height="2" fill="#180408" />
              <rect x="6" y="3" width="1" height="2" fill="#180408" />
              <rect x="2" y="3" width="1" height="1" fill="#fecdd3" fillOpacity="0.85" />
            </>
          ) : (
            <rect x="2" y="3" width="1" height="1" fill="#ffffff" fillOpacity="0.88" />
          )}
        </>
      )}
      {state === 'half' && (
        <>
          <path d="M1 2h2v1h1v1h0.5v4H4V7H3V6H2V5H1V2z" fill={`url(#${gradId})`} />
          {hardcore ? (
            <rect x="2" y="3" width="1" height="2" fill="#180408" />
          ) : (
            <rect x="2" y="3" width="1" height="1" fill="#ffffff" fillOpacity="0.88" />
          )}
        </>
      )}
    </svg>
  );
}

function PixelHunger({ state, index }: { state: 'full' | 'half' | 'empty'; index: number }) {
  const gradId = `rainbow-hunger-${index}`;
  const [c1, c2, c3] = RAINBOW_PAIRS[index % RAINBOW_PAIRS.length];
  return (
    <svg width="16" height="16" viewBox="0 0 9 9" className="pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="50%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </linearGradient>
      </defs>
      <path d="M4 1h3v1h1v3H7v1H5v1H3v1H1V6h1V5h1V3h1V1z" fill="#141414" />
      <path d="M4 2h3v3H5v1H4V2z" fill="#3a2d24" />
      {state !== 'empty' && (
        <>
          <path
            d={state === 'full' ? 'M4 2h3v3H5v1H4V2z' : 'M4 2h1.5v4H4V2z'}
            fill={`url(#${gradId})`}
          />
          <rect x="2" y="6" width="2" height="1" fill="#e8dcc8" />
          <rect x="5" y="3" width="1" height="1" fill="#ffffff" fillOpacity="0.88" />
        </>
      )}
    </svg>
  );
}

function PixelArmor({ state }: { state: 'full' | 'half' | 'empty' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 9 9" className="pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
      <path d="M1 1h2v1h3V1h2v5H7v1H6v1H5v1H4V8H3V7H2V6H1V1z" fill="#141414" />
      <path d="M2 2h1v1h3V2h1v4H6v1H5v1H4V7H3V6H2V2z" fill="#2c333f" />
      {state === 'full' && (
        <>
          <path d="M2 2h1v1h3V2h1v4H6v1H5v1H4V7H3V6H2V2z" fill="#b8d0e8" />
          <path d="M2 2h1v3H2V2zm4 0h1v3H6V2z" fill="#e6f2ff" />
          <rect x="4" y="4" width="1" height="3" fill="#7c98b6" />
        </>
      )}
      {state === 'half' && (
        <>
          <path d="M2 2h1v1h1.5v5H4V7H3V6H2V2z" fill="#b8d0e8" />
          <path d="M2 2h1v3H2V2z" fill="#e6f2ff" />
        </>
      )}
    </svg>
  );
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  activeSkin,
  muted,
  onToggleMute,
  onOpenPause,
  onOpenInventory,
  onSelectSlot,
  getIcon,
  connectionStatus,
  activeRoom,
  remotePlayers,
  chatMessages,
  chatOpen,
  onOpenChat,
  onCloseChat,
  onSendChat,
  voiceState,
  onToggleVoice,
}) => {
  const [chatText, setChatText] = useState('');
  const [wyrVoiceTick, setWyrVoiceTick] = useState(0);
  const lastSpokenKeyRef = useRef<string>('');
  const held = hud.inventory[hud.selectedSlot];
  const heldName = held ? BLOCK_DEFS[held.id]?.name : null;
  const isDay = hud.timeOfDay > 0.05 && hud.timeOfDay < 0.55;
  const skinFaceUrl = renderSkinFaceDataUrl(activeSkin);
  const isOnline = connectionStatus !== 'offline' && !!activeRoom;
  const speakingPeers = remotePlayers.filter((p) => p.isSpeaking);

  const wyrSpeaking = wyrVoiceNarrator.isSpeaking();
  const wyrVoiceEnabled = wyrVoiceNarrator.isEnabled();
  const wyrVoiceStyle = wyrVoiceNarrator.getStyle();
  void wyrVoiceTick;

  useEffect(() => {
    return wyrVoiceNarrator.subscribe(() => {
      setWyrVoiceTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (muted) {
      wyrVoiceNarrator.stop();
    }
  }, [muted]);

  useEffect(() => {
    return () => {
      wyrVoiceNarrator.stop();
    };
  }, []);

  const triggerWyrSpeak = (force = false) => {
    if (hud.worldType !== 'wouldyourather' || muted) return;
    const level = hud.wyrLevel ?? 1;
    const optionA = hud.wyrOptionA ?? '';
    const optionB = hud.wyrOptionB ?? '';
    const finished = Boolean(hud.wyrFinished);
    if (!finished && (!optionA || !optionB)) return;
    void wyrVoiceNarrator.speakQuestion(
      {
        level,
        optionA,
        optionB,
        isMilestone: level % 10 === 0,
        finished,
      },
      { force, chime: true }
    );
  };

  useEffect(() => {
    if (hud.worldType !== 'wouldyourather') {
      lastSpokenKeyRef.current = '';
      wyrVoiceNarrator.stop();
      return;
    }
    const level = hud.wyrLevel ?? 1;
    const optionA = hud.wyrOptionA ?? '';
    const optionB = hud.wyrOptionB ?? '';
    const finished = Boolean(hud.wyrFinished);
    if (!finished && (!optionA || !optionB)) return;

    const key = `${finished ? 'fin' : level}:${optionA}|${optionB}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;

    if (!muted && wyrVoiceNarrator.isEnabled()) {
      void wyrVoiceNarrator.speakQuestion(
        {
          level,
          optionA,
          optionB,
          isMilestone: level % 10 === 0,
          finished,
        },
        { chime: true }
      );
    }
  }, [hud.worldType, hud.wyrLevel, hud.wyrOptionA, hud.wyrOptionB, hud.wyrFinished, muted]);

  useEffect(() => {
    if (hud.worldType !== 'wouldyourather') return;
    const onKey = (e: KeyboardEvent) => {
      if (chatOpen) return;
      if (e.code === 'KeyN' && !e.repeat) {
        e.preventDefault();
        const level = hud.wyrLevel ?? 1;
        const optionA = hud.wyrOptionA ?? '';
        const optionB = hud.wyrOptionB ?? '';
        const finished = Boolean(hud.wyrFinished);
        if (!muted && (finished || (optionA && optionB))) {
          void wyrVoiceNarrator.speakQuestion(
            {
              level,
              optionA,
              optionB,
              isMilestone: level % 10 === 0,
              finished,
            },
            { force: true, chime: true }
          );
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.worldType, hud.wyrLevel, hud.wyrOptionA, hud.wyrOptionB, hud.wyrFinished, chatOpen, muted]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      {hud.portalChargeProgress > 0.01 && (
        <div
          className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-75"
          style={{
            opacity: Math.min(0.88, 0.25 + hud.portalChargeProgress * 0.65),
            background:
              'radial-gradient(circle at center, rgba(168, 85, 247, 0.22) 15%, rgba(126, 34, 206, 0.58) 65%, rgba(59, 7, 100, 0.9) 100%)',
          }}
        />
      )}
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Compact World Info */}
        <div className="flex items-center gap-2.5 rounded-none border border-white/15 bg-[#12161c]/82 px-3 py-1.5 text-xs text-slate-100 shadow-lg">
          {skinFaceUrl && (
            <img
              src={skinFaceUrl}
              alt={activeSkin.name}
              title={`Skin: ${activeSkin.name}`}
              className="pixelated h-5 w-5 border border-white/25"
            />
          )}
          <div className="flex items-center gap-1.5 font-semibold tracking-wide text-amber-300">
            {isDay ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5 text-indigo-300" />}
            <span className="tabular-nums">Day {hud.dayCount}</span>
          </div>
          <span className="text-white/25">|</span>
          <span
            className={`font-medium ${
              hud.dimension === 'nether'
                ? 'text-rose-300'
                : hud.isUnderground
                  ? 'text-cyan-300'
                  : 'text-emerald-300'
            }`}
          >
            {hud.biome}
          </span>
          <span className="text-white/25">|</span>
          <span className="font-mono text-[11px] text-slate-300 tabular-nums">
            {hud.coords.x}, {hud.coords.y}, {hud.coords.z}
          </span>
          {hud.dimension === 'nether' && (
            <span className="rounded-none border border-rose-500/50 bg-rose-950/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
              Nether
            </span>
          )}
          {hud.worldType === 'oneblock' && (
            <span className="rounded-none border border-emerald-400/50 bg-emerald-950/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200">
              Block #{hud.oneBlockCount ?? 0} · {hud.oneBlockPhase ?? 'Phase 1'}
            </span>
          )}
          {hud.worldType === 'wouldyourather' && (
            <span className="rounded-none border border-amber-400/50 bg-amber-950/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-200">
              WYR Q{hud.wyrLevel ?? 1}/100
            </span>
          )}
          {hud.twoPlayerMode && (
            <span className="rounded-none border border-cyan-400/50 bg-cyan-950/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
              2P Split
            </span>
          )}
          <span
            className={`rounded-none px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              hud.mode === 'hardcore'
                ? 'border border-rose-500/70 bg-rose-950/90 font-black text-rose-200'
                : 'bg-white/10 text-slate-200'
            }`}
          >
            {hud.mode}
            {hud.spectating ? ' · Spectate' : hud.isFlying ? ' · Fly' : ''}
          </span>
          {isOnline && activeRoom && (
            <>
              <span className="text-white/25">|</span>
              <span
                className="flex items-center gap-1 font-bold text-cyan-300"
                title={`Room ${activeRoom.id}`}
              >
                <Users className="h-3.5 w-3.5" />
                {activeRoom.id} · {remotePlayers.length + 1}
              </span>
            </>
          )}
        </div>

        {/* Top-Right Compact Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isOnline && (
            <>
              <button
                type="button"
                onClick={onToggleVoice}
                className={`flex items-center gap-1 rounded-none border px-2.5 py-1.5 text-xs font-semibold transition ${
                  !voiceState.enabled
                    ? 'border-white/20 bg-[#12161c]/88 text-slate-300 hover:bg-[#1e2530]'
                    : voiceState.muted
                      ? 'border-amber-400/45 bg-amber-950/75 text-amber-200 hover:bg-amber-900/80'
                      : 'border-emerald-400/60 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900/85'
                }`}
                title={
                  !voiceState.enabled
                    ? 'Join Voice Chat (V)'
                    : voiceState.muted
                      ? 'Unmute Microphone (V)'
                      : 'Mute Microphone (V)'
                }
              >
                {voiceState.enabled && !voiceState.muted ? (
                  <Mic className={`h-3.5 w-3.5 ${voiceState.speaking ? 'animate-pulse text-emerald-300' : 'text-emerald-400'}`} />
                ) : (
                  <MicOff className="h-3.5 w-3.5 text-amber-300" />
                )}
                {!voiceState.enabled ? 'Voice [V]' : voiceState.muted ? 'Muted [V]' : 'Live [V]'}
              </button>
              <button
                type="button"
                onClick={onOpenChat}
                className="flex items-center gap-1 rounded-none border border-cyan-400/35 bg-[#12161c]/88 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-[#1e2530]"
                title="Open Multiplayer Chat (T)"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat [T]
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onOpenInventory}
            className="rounded-none border border-white/15 bg-[#12161c]/88 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-[#1e2530]"
            title="Inventory & Crafting (E)"
          >
            Bag [E]
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="rounded-none border border-white/15 bg-[#12161c]/88 p-1.5 text-slate-200 transition hover:bg-[#1e2530]"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
          <button
            type="button"
            onClick={onOpenPause}
            className="flex items-center gap-1.5 rounded-none border border-white/15 bg-[#12161c]/88 px-2.5 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-[#1e2530]"
            title="Open Game Menu (Esc)"
          >
            <Menu className="h-3.5 w-3.5 text-emerald-300" />
            Menu [Esc]
          </button>
        </div>
      </div>

      {/* Would You Rather 100-Level Question Banner */}
      {hud.worldType === 'wouldyourather' && (
        <div className="pointer-events-none fixed left-1/2 top-12 z-10 w-[min(94vw,620px)] -translate-x-1/2">
          {hud.wyrFinished ? (
            <div className="border-2 border-amber-400/80 bg-[#11151d]/92 px-3 py-2 text-center shadow-xl">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black tracking-widest text-amber-300 uppercase">
                <span>100 / 100 Complete · Champion Summit</span>
                <button
                  type="button"
                  onClick={() => triggerWyrSpeak(true)}
                  className="pointer-events-auto flex items-center gap-1 border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-200 hover:bg-amber-500/35"
                >
                  <Volume2 className="h-3 w-3" />
                  Replay [N]
                </button>
              </div>
              <div className="text-xs font-extrabold text-white">
                All 100 Would You Rather Choices Cleared! (Left A: {hud.wyrChoicesA ?? 0} · Right B: {hud.wyrChoicesB ?? 0})
              </div>
            </div>
          ) : (
            <div className="border border-white/20 bg-[#10141c]/92 px-3 py-2 shadow-xl">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1 text-[10px] font-bold tracking-wider uppercase">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300">
                    Q{hud.wyrLevel ?? 1}/100 · {hud.wyrChapter ?? 'Starter Survival'}
                  </span>
                  {wyrSpeaking && (
                    <span className="flex items-center gap-1 border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-200">
                      <span className="inline-block h-2 w-0.5 animate-pulse bg-emerald-300" />
                      <span className="inline-block h-2.5 w-0.5 animate-pulse bg-emerald-300" />
                      <span className="inline-block h-1.5 w-0.5 animate-pulse bg-emerald-300" />
                      Speaking
                    </span>
                  )}
                </div>
                <div className="pointer-events-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      wyrVoiceNarrator.cycleStyle();
                      if (!muted) triggerWyrSpeak(true);
                    }}
                    className="flex items-center gap-1 border border-fuchsia-400/45 bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-black text-fuchsia-200 transition hover:bg-fuchsia-500/30"
                    title="Switch Cool Narrator Voice"
                  >
                    <Sparkles className="h-2.5 w-2.5 text-fuchsia-300" />
                    {WYR_VOICE_STYLE_LABELS[wyrVoiceStyle]}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerWyrSpeak(true)}
                    className="flex items-center gap-1 border border-sky-400/45 bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-black text-sky-200 transition hover:bg-sky-500/30"
                    title="Replay Question Voice (Press N)"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Say [N]
                  </button>
                  <button
                    type="button"
                    onClick={() => wyrVoiceNarrator.setEnabled(!wyrVoiceEnabled)}
                    className={`flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-black transition ${
                      wyrVoiceEnabled
                        ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30'
                        : 'border-white/20 bg-white/5 text-slate-400 hover:bg-white/15'
                    }`}
                    title={wyrVoiceEnabled ? 'Auto-Voice ON' : 'Auto-Voice OFF'}
                  >
                    {wyrVoiceEnabled ? <Volume2 className="h-2.5 w-2.5" /> : <VolumeX className="h-2.5 w-2.5" />}
                    {wyrVoiceEnabled ? 'Auto' : 'Off'}
                  </button>
                  {hud.wyrP2Choice && (
                    <span className="bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">
                      P2: {hud.wyrP2Choice}
                    </span>
                  )}
                  <span className="font-mono text-slate-300 tabular-nums">
                    A:{hud.wyrChoicesA ?? 0} | B:{hud.wyrChoicesB ?? 0}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                <div className="border border-emerald-400/55 bg-emerald-950/65 px-2.5 py-1.5">
                  <div className="text-[9px] font-black tracking-wider text-emerald-300 uppercase">
                    &larr; Left Gate [A]
                  </div>
                  <div className="font-bold text-white">{hud.wyrOptionA ?? 'Choose Left Gate'}</div>
                </div>
                <div className="border border-amber-400/55 bg-amber-950/65 px-2.5 py-1.5 text-right">
                  <div className="text-[9px] font-black tracking-wider text-amber-300 uppercase">
                    Right Gate [B] &rarr;
                  </div>
                  <div className="font-bold text-white">{hud.wyrOptionB ?? 'Choose Right Gate'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Voice Speakers Indicator & Chat Overlay */}
      {isOnline && (voiceState.speaking || speakingPeers.length > 0 || voiceState.error) && (
        <div className="pointer-events-none fixed right-3 top-14 z-20 flex flex-col items-end gap-1 sm:right-4">
          {voiceState.error && (
            <div className="border border-rose-400/50 bg-rose-950/90 px-2.5 py-1 text-[11px] font-medium text-rose-200">
              {voiceState.error}
            </div>
          )}
          {voiceState.speaking && (
            <div className="flex items-center gap-1.5 border border-emerald-400/60 bg-emerald-950/85 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
              <Mic className="h-3 w-3 animate-pulse text-emerald-300" />
              You (Speaking)
            </div>
          )}
          {speakingPeers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 border border-cyan-400/60 bg-[#0d1822]/85 px-2.5 py-1 text-[11px] font-bold text-cyan-200"
            >
              <Mic className="h-3 w-3 animate-pulse text-emerald-300" />
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Multiplayer Chat Overlay */}
      {isOnline && (chatMessages.length > 0 || chatOpen) && (
        <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex w-80 max-w-[85vw] flex-col gap-1 sm:left-4">
          <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto bg-black/50 p-2 text-[11px] leading-snug backdrop-blur-[2px]">
            {chatMessages.slice(-7).map((m) => (
              <div key={m.id} className={m.system ? 'italic text-amber-200/90' : 'text-slate-100'}>
                {!m.system && <span className="font-bold text-cyan-300">&lt;{m.senderName}&gt; </span>}
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          {chatOpen && (
            <form
              className="pointer-events-auto flex items-center gap-1 border border-cyan-400/50 bg-[#0d1118]/95 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (chatText.trim()) {
                  onSendChat(chatText);
                  setChatText('');
                }
                onCloseChat();
              }}
            >
              <input
                type="text"
                autoFocus
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onCloseChat();
                  }
                }}
                maxLength={220}
                placeholder="Type message & press Enter..."
                className="w-full bg-transparent px-2 py-1 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1 bg-cyan-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-400"
              >
                <Send className="h-3 w-3" />
                Send
              </button>
            </form>
          )}
        </div>
      )}

      {/* Split-screen divider when 2P is active */}
      {hud.twoPlayerMode && hud.p2 && (
        <div className="pointer-events-none fixed inset-y-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-white/35 shadow-[0_0_8px_rgba(0,0,0,0.9)]" />
      )}

      {/* Center Crosshair & Status Banner (Single-Player vs Split-Screen Dual Crosshairs) */}
      {hud.twoPlayerMode && hud.p2 ? (
        <div className="pointer-events-none fixed inset-0 flex">
          {/* P1 Left Crosshair */}
          <div className="relative flex w-1/2 items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="h-0.5 w-4 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
              <div className="absolute h-4 w-0.5 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
              {hud.targetBlockName && (
                <div className="absolute top-6 whitespace-nowrap rounded-none bg-[#101318]/80 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                  {hud.targetBlockName}
                </div>
              )}
              {hud.breakProgress > 0.02 && (
                <div className="absolute top-12 h-1.5 w-14 overflow-hidden rounded-none border border-black/80 bg-black/60">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.min(100, Math.round(hud.breakProgress * 100))}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* P2 Right Crosshair */}
          <div className="relative flex w-1/2 items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="h-0.5 w-4 bg-cyan-200/95 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
              <div className="absolute h-4 w-0.5 bg-cyan-200/95 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
              {hud.p2.targetBlockName && (
                <div className="absolute top-6 whitespace-nowrap rounded-none bg-[#101318]/80 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                  {hud.p2.targetBlockName}
                </div>
              )}
              {hud.p2.breakProgress > 0.02 && (
                <div className="absolute top-12 h-1.5 w-14 overflow-hidden rounded-none border border-black/80 bg-black/60">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, Math.round(hud.p2.breakProgress * 100))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Crisp Pixel Crosshair */}
            <div className="h-0.5 w-4 bg-white/85 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
            <div className="absolute h-4 w-0.5 bg-white/85 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />

            {/* Target Block Label */}
            {hud.targetBlockName && (
              <div className="absolute top-6 whitespace-nowrap rounded-none bg-[#101318]/80 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                {hud.targetBlockName}
              </div>
            )}

            {/* Mining Progress Bar */}
            {hud.breakProgress > 0.02 && (
              <div className="absolute top-12 h-1.5 w-16 overflow-hidden rounded-none border border-black/80 bg-black/60">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, Math.round(hud.breakProgress * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Hotbar & Survival Bars */}
      {hud.twoPlayerMode && hud.p2 ? (
        <div className="flex w-full items-end justify-between gap-2 pb-1">
          {/* P1 Left Bottom Cluster */}
          <div className="flex w-1/2 flex-col items-center gap-1 pr-2">
            {hud.statusMessage && (
              <div className="rounded-none bg-[#101318]/90 px-2.5 py-0.5 text-[11px] font-medium text-amber-200 shadow">
                {hud.statusMessage}
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              <span>P1</span>
              {heldName && <span className="text-white">· {heldName}</span>}
            </div>
            {(hud.mode === 'survival' || hud.mode === 'hardcore') && !hud.spectating && (
              <div className="flex w-full max-w-[340px] items-center justify-between px-1">
                <div className="flex items-center gap-0.5" aria-label="P1 Health">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = hud.health - i * 2;
                    const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                    return <PixelHeart key={i} index={i} state={state} hardcore={hud.mode === 'hardcore'} />;
                  })}
                </div>
                <div className="flex items-center gap-0.5" aria-label="P1 Hunger">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = hud.hunger - i * 2;
                    const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                    return <PixelHunger key={i} index={i} state={state} />;
                  })}
                </div>
              </div>
            )}
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-none border-2 border-[#303642] bg-[#161a21]/92 p-0.5 shadow-2xl">
              {Array.from({ length: HOTBAR_SIZE }).map((_, idx) => {
                const slot = hud.inventory[idx];
                const active = hud.selectedSlot === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectSlot(idx)}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-none border sm:h-9 sm:w-9 ${
                      active
                        ? 'scale-105 border-amber-300 bg-[#3a4250]'
                        : 'border-[#262b35] bg-[#21262f] hover:border-slate-500'
                    }`}
                  >
                    <span className="absolute left-0.5 top-0 text-[8px] font-mono text-slate-400/80">
                      {idx + 1}
                    </span>
                    {slot && (
                      <>
                        <img
                          src={getIcon(slot.id)}
                          alt={BLOCK_DEFS[slot.id]?.name}
                          className="pixelated h-6 w-6"
                          draggable={false}
                        />
                        {slot.count > 1 && (
                          <span className="tabular-nums absolute bottom-0 right-0.5 text-[9px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
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

          {/* P2 Right Bottom Cluster */}
          <div className="flex w-1/2 flex-col items-center gap-1 pl-2">
            <div className="rounded-none bg-[#101318]/82 px-2 py-0.5 text-[10px] text-cyan-200">
              P2: Arrows Move · IJKL Look · R-Shift Jump · O Mine · P Place · [/] Slot
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              <span>
                P2 ({hud.p2.coords.x}, {hud.p2.coords.y}, {hud.p2.coords.z})
              </span>
              {hud.p2.inventory[hud.p2.selectedSlot] && (
                <span className="text-white">
                  · {BLOCK_DEFS[hud.p2.inventory[hud.p2.selectedSlot]!.id]?.name}
                </span>
              )}
            </div>
            {(hud.mode === 'survival' || hud.mode === 'hardcore') && !hud.spectating && (
              <div className="flex w-full max-w-[340px] items-center justify-between px-1">
                <div className="flex items-center gap-0.5" aria-label="P2 Health">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = hud.p2!.health - i * 2;
                    const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                    return <PixelHeart key={i} index={i} state={state} hardcore={hud.mode === 'hardcore'} />;
                  })}
                </div>
                <div className="flex items-center gap-0.5" aria-label="P2 Hunger">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = hud.p2!.hunger - i * 2;
                    const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                    return <PixelHunger key={i} index={i} state={state} />;
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-0.5 rounded-none border-2 border-cyan-500/40 bg-[#131924]/92 p-0.5 shadow-2xl">
              {Array.from({ length: HOTBAR_SIZE }).map((_, idx) => {
                const slot = hud.p2!.inventory[idx];
                const active = hud.p2!.selectedSlot === idx;
                return (
                  <div
                    key={idx}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-none border sm:h-9 sm:w-9 ${
                      active ? 'scale-105 border-cyan-300 bg-[#2b3b4e]' : 'border-[#222a36] bg-[#1b212d]'
                    }`}
                  >
                    <span className="absolute left-0.5 top-0 text-[8px] font-mono text-cyan-300/70">
                      {idx + 1}
                    </span>
                    {slot && (
                      <>
                        <img
                          src={getIcon(slot.id)}
                          alt={BLOCK_DEFS[slot.id]?.name}
                          className="pixelated h-6 w-6"
                          draggable={false}
                        />
                        {slot.count > 1 && (
                          <span className="tabular-nums absolute bottom-0 right-0.5 text-[9px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                            {slot.count}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 pb-1">
          {hud.statusMessage && (
            <div className="rounded-none bg-[#101318]/90 px-3 py-1 text-xs font-medium text-amber-200 shadow">
              {hud.statusMessage}
            </div>
          )}

          {!hud.pointerLocked && (
            <div className="rounded-none bg-[#101318]/82 px-2.5 py-0.5 text-[11px] text-slate-300">
              Click viewport to lock cursor · Drag to look · E for Crafting
            </div>
          )}

          {heldName && (
            <div className="text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              {heldName}
            </div>
          )}

          {(hud.mode === 'survival' || hud.mode === 'hardcore') && !hud.spectating && (
            <div className="flex w-[420px] max-w-[94vw] items-end justify-between px-1">
              <div className="flex flex-col items-start gap-1">
                {hud.armorDefense > 0 && (
                  <div className="flex items-center gap-0.5" aria-label="Armor Defense">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const v = hud.armorDefense - i * 2;
                      const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                      return <PixelArmor key={i} state={state} />;
                    })}
                  </div>
                )}
                <div className="flex items-center gap-0.5" aria-label="Health">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = hud.health - i * 2;
                    const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                    return <PixelHeart key={i} index={i} state={state} hardcore={hud.mode === 'hardcore'} />;
                  })}
                </div>
              </div>
              <div className="flex items-center gap-0.5" aria-label="Hunger">
                {Array.from({ length: 10 }).map((_, i) => {
                  const v = hud.hunger - i * 2;
                  const state = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
                  return <PixelHunger key={i} index={i} state={state} />;
                })}
              </div>
            </div>
          )}

          {/* 9-Slot Hotbar */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-none border-2 border-[#303642] bg-[#161a21]/92 p-1 shadow-2xl">
            {Array.from({ length: HOTBAR_SIZE }).map((_, idx) => {
              const slot = hud.inventory[idx];
              const active = hud.selectedSlot === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSlot(idx)}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-none border-2 transition-transform ${
                    active
                      ? 'scale-105 border-amber-300 bg-[#3a4250]'
                      : 'border-[#262b35] bg-[#21262f] hover:border-slate-500'
                  }`}
                  title={slot ? BLOCK_DEFS[slot.id]?.name : `Slot ${idx + 1}`}
                >
                  <span className="absolute left-0.5 top-0 text-[9px] font-mono text-slate-400/80">
                    {idx + 1}
                  </span>
                  {slot && (
                    <>
                      <img
                        src={getIcon(slot.id)}
                        alt={BLOCK_DEFS[slot.id]?.name}
                        className="pixelated h-8 w-8"
                        draggable={false}
                      />
                      {slot.count > 1 && (
                        <span className="tabular-nums absolute bottom-0 right-1 text-[11px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
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
      )}
    </div>
  );
};
