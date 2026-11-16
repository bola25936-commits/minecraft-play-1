import { soundEngine } from './audio';
import { WOULD_YOU_RATHER_LEVELS } from './wouldYouRather100';

export type WyrVoiceStyle = 'host' | 'legend' | 'hype';

export const WYR_VOICE_STYLE_LABELS: Record<WyrVoiceStyle, string> = {
  host: 'Epic Host',
  legend: 'Deep Boss',
  hype: 'Arcade Hype',
};

const STORAGE_STYLE_KEY = 'voxelcraft_wyr_voice_style';
const STORAGE_ENABLED_KEY = 'voxelcraft_wyr_voice_enabled';

export interface WyrVoicePayload {
  level: number;
  optionA: string;
  optionB: string;
  isMilestone?: boolean;
  finished?: boolean;
}

class WyrVoiceNarrator {
  private audioEl: HTMLAudioElement | null = null;
  private clipCache = new Map<string, string>();
  private inFlight = new Map<string, Promise<string | null>>();
  private activeToken = 0;
  private speaking = false;
  private listeners = new Set<() => void>();
  private style: WyrVoiceStyle = 'host';
  private enabled = true;
  private serverUnavailable = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedStyle = window.localStorage.getItem(STORAGE_STYLE_KEY);
        if (savedStyle === 'host' || savedStyle === 'legend' || savedStyle === 'hype') {
          this.style = savedStyle;
        }
        const savedEnabled = window.localStorage.getItem(STORAGE_ENABLED_KEY);
        if (savedEnabled === 'false') {
          this.enabled = false;
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStyle(): WyrVoiceStyle {
    return this.style;
  }

  setEnabled(next: boolean) {
    this.enabled = next;
    try {
      window.localStorage.setItem(STORAGE_ENABLED_KEY, String(next));
    } catch {
      // ignore
    }
    if (!next) {
      this.stop();
    }
    this.notify();
  }

  cycleStyle(): WyrVoiceStyle {
    const order: WyrVoiceStyle[] = ['host', 'legend', 'hype'];
    const idx = order.indexOf(this.style);
    const next = order[(idx + 1) % order.length];
    this.style = next;
    try {
      window.localStorage.setItem(STORAGE_STYLE_KEY, next);
    } catch {
      // ignore
    }
    this.notify();
    return next;
  }

  stop() {
    this.activeToken++;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.speaking) {
      this.speaking = false;
      this.notify();
    }
  }

  private makeCacheKey(payload: WyrVoicePayload, style: WyrVoiceStyle): string {
    return `${style}:${payload.finished ? 'fin' : payload.level}:${payload.optionA}|${payload.optionB}`;
  }

  private async fetchTtsClipUrl(payload: WyrVoicePayload, style: WyrVoiceStyle): Promise<string | null> {
    if (this.serverUnavailable) return null;
    const key = this.makeCacheKey(payload, style);
    const existing = this.clipCache.get(key);
    if (existing) return existing;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const reqPromise = (async () => {
      try {
        const res = await fetch('/api/wyr/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: payload.level,
            optionA: payload.optionA,
            optionB: payload.optionB,
            isMilestone: Boolean(payload.isMilestone),
            finished: Boolean(payload.finished),
            style,
          }),
        });
        if (res.status === 503) {
          this.serverUnavailable = true;
          return null;
        }
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.size) return null;
        const url = URL.createObjectURL(blob);
        if (this.clipCache.size >= 40) {
          const oldestKey = this.clipCache.keys().next().value;
          if (oldestKey) {
            const oldUrl = this.clipCache.get(oldestKey);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            this.clipCache.delete(oldestKey);
          }
        }
        this.clipCache.set(key, url);
        return url;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, reqPromise);
    return reqPromise;
  }

  private prefetchNext(currentLevel: number, style: WyrVoiceStyle) {
    if (this.serverUnavailable || currentLevel >= 100) return;
    const nextLvl = WOULD_YOU_RATHER_LEVELS[currentLevel + 1];
    if (!nextLvl || nextLvl.level > 100) return;
    void this.fetchTtsClipUrl(
      {
        level: nextLvl.level,
        optionA: nextLvl.optionA,
        optionB: nextLvl.optionB,
        isMilestone: nextLvl.isMilestone,
      },
      style
    );
  }

  private pickCoolBrowserVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const preferred = [
      'Daniel',
      'Aaron',
      'Arthur',
      'Guy',
      'Christopher',
      'Ryan',
      'Google UK English Male',
      'Microsoft Andrew',
      'Microsoft Guy',
      'Alex',
      'Google US English',
    ];
    for (const name of preferred) {
      const match = voices.find((v) => v.name.includes(name) && v.lang.startsWith('en'));
      if (match) return match;
    }
    return voices.find((v) => v.lang.startsWith('en')) ?? voices[0];
  }

  private speakWithBrowserFallback(payload: WyrVoicePayload, style: WyrVoiceStyle, token: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (token === this.activeToken) {
        this.speaking = false;
        this.notify();
      }
      return;
    }

    const text = payload.finished
      ? 'Incredible! You conquered all one hundred Would You Rather challenges! Step up and claim your Champion Trophy!'
      : payload.level === 1
        ? `Question 1! Would you rather ${payload.optionA}, or ${payload.optionB}?`
        : payload.isMilestone
          ? `Milestone Question ${payload.level}! Would you rather ${payload.optionA}, or ${payload.optionB}?`
          : `Question ${payload.level}! Would you rather ${payload.optionA}, or ${payload.optionB}?`;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = this.pickCoolBrowserVoice();
      if (voice) utter.voice = voice;

      if (style === 'legend') {
        utter.pitch = 0.72;
        utter.rate = 0.92;
      } else if (style === 'hype') {
        utter.pitch = 1.12;
        utter.rate = 1.08;
      } else {
        utter.pitch = 0.85;
        utter.rate = 1.01;
      }
      utter.volume = 0.95;

      utter.onstart = () => {
        if (token !== this.activeToken) return;
        this.speaking = true;
        this.notify();
      };
      utter.onend = () => {
        if (token !== this.activeToken) return;
        this.speaking = false;
        this.notify();
      };
      utter.onerror = () => {
        if (token !== this.activeToken) return;
        this.speaking = false;
        this.notify();
      };

      this.speaking = true;
      this.notify();
      window.speechSynthesis.speak(utter);
    } catch {
      if (token === this.activeToken) {
        this.speaking = false;
        this.notify();
      }
    }
  }

  async speakQuestion(payload: WyrVoicePayload, opts?: { force?: boolean; chime?: boolean }) {
    if (soundEngine.muted) return;
    if (!this.enabled && !opts?.force) return;

    this.stop();
    const token = this.activeToken;
    const style = this.style;

    if (opts?.chime !== false) {
      soundEngine.playWyrQuestionChime();
    }

    this.speaking = true;
    this.notify();

    const clipUrl = await this.fetchTtsClipUrl(payload, style);
    if (token !== this.activeToken || soundEngine.muted) {
      if (token === this.activeToken) {
        this.speaking = false;
        this.notify();
      }
      return;
    }

    if (clipUrl) {
      try {
        const audio = new Audio(clipUrl);
        audio.volume = 0.92;
        this.audioEl = audio;
        audio.onended = () => {
          if (token !== this.activeToken) return;
          this.audioEl = null;
          this.speaking = false;
          this.notify();
        };
        audio.onerror = () => {
          if (token !== this.activeToken) return;
          this.audioEl = null;
          this.speakWithBrowserFallback(payload, style, token);
        };
        await audio.play();
        if (!payload.finished) {
          this.prefetchNext(payload.level, style);
        }
        return;
      } catch {
        this.audioEl = null;
      }
    }

    if (token === this.activeToken && !soundEngine.muted) {
      this.speakWithBrowserFallback(payload, style, token);
    }
  }
}

export const wyrVoiceNarrator = new WyrVoiceNarrator();
