export type VoiceSpatialMode = 'global' | 'spatial';

export interface VoiceStateSnapshot {
  enabled: boolean;
  muted: boolean;
  speaking: boolean;
  spatialMode: VoiceSpatialMode;
  error: string | null;
  connectedPeerCount: number;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  sender: RTCRtpSender | null;
  makingOffer: boolean;
  ignoreOffer: boolean;
  remoteVoiceEnabled: boolean;
}

export interface VoiceChatCallbacks {
  sendSignal: (targetId: string, signal: unknown) => void;
  sendVoiceState: (voiceEnabled: boolean, voiceMuted: boolean, isSpeaking: boolean) => void;
  onStateChange: (snapshot: VoiceStateSnapshot) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class VoiceChatManager {
  private callbacks: VoiceChatCallbacks;
  private youId: string | null = null;
  private knownPeers = new Map<string, boolean>(); // peerId -> remoteVoiceEnabled
  private peers = new Map<string, PeerEntry>();

  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: number | null = null;

  private enabled = false;
  private muted = true;
  private speaking = false;
  private spatialMode: VoiceSpatialMode = 'global';
  private error: string | null = null;

  constructor(callbacks: VoiceChatCallbacks) {
    this.callbacks = callbacks;
  }

  public getSnapshot(): VoiceStateSnapshot {
    let connected = 0;
    for (const p of this.peers.values()) {
      if (p.pc.connectionState === 'connected' || p.pc.iceConnectionState === 'connected') {
        connected++;
      }
    }
    return {
      enabled: this.enabled,
      muted: this.muted,
      speaking: this.speaking,
      spatialMode: this.spatialMode,
      error: this.error,
      connectedPeerCount: connected,
    };
  }

  public setSpatialMode(mode: VoiceSpatialMode) {
    this.spatialMode = mode;
    if (mode === 'global') {
      for (const peer of this.peers.values()) {
        peer.audioEl.volume = 1;
      }
    }
    this.emitState();
  }

  public syncRoomPeers(youId: string | null, remotePeers: { id: string; voiceEnabled?: boolean }[]) {
    this.youId = youId;
    if (!youId) {
      this.cleanupAllPeers();
      this.knownPeers.clear();
      this.emitState();
      return;
    }

    const nextIds = new Set<string>();
    for (const p of remotePeers) {
      if (p.id === youId) continue;
      nextIds.add(p.id);
      this.knownPeers.set(p.id, Boolean(p.voiceEnabled));
    }

    for (const existingId of Array.from(this.knownPeers.keys())) {
      if (!nextIds.has(existingId)) {
        this.knownPeers.delete(existingId);
        this.closePeer(existingId);
      }
    }

    this.reconcilePeers();
    this.emitState();
  }

  public onPeerJoined(peerId: string, voiceEnabled = false) {
    if (!this.youId || peerId === this.youId) return;
    this.knownPeers.set(peerId, voiceEnabled);
    this.reconcilePeers();
    this.emitState();
  }

  public onPeerLeft(peerId: string) {
    this.knownPeers.delete(peerId);
    this.closePeer(peerId);
    this.emitState();
  }

  public onPeerVoiceUpdated(peerId: string, voiceEnabled: boolean) {
    if (!this.youId || peerId === this.youId) return;
    this.knownPeers.set(peerId, voiceEnabled);
    const existing = this.peers.get(peerId);
    if (existing) {
      existing.remoteVoiceEnabled = voiceEnabled;
    }
    this.reconcilePeers();
    this.emitState();
  }

  public async joinVoice(startUnmuted = true): Promise<boolean> {
    if (this.enabled && this.localStream) {
      if (startUnmuted && this.muted) {
        this.setMuted(false);
      }
      return true;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'Microphone is unavailable in this browser context.';
      this.emitState();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.localStream = stream;
      this.enabled = true;
      this.muted = !startUnmuted;
      this.error = null;

      for (const track of stream.getAudioTracks()) {
        track.enabled = !this.muted;
      }

      this.startVadMonitor(stream);

      // Attach local audio track to active peers or spin up needed peers
      for (const [peerId, entry] of this.peers) {
        this.attachLocalTrack(peerId, entry);
      }
      this.reconcilePeers();

      this.callbacks.sendVoiceState(this.enabled, this.muted, this.speaking);
      this.emitState();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied';
      this.error = msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Microphone permission denied. Check browser site settings.'
        : 'Could not access microphone.';
      this.enabled = false;
      this.muted = true;
      this.speaking = false;
      this.emitState();
      return false;
    }
  }

  public leaveVoice() {
    this.stopVadMonitor();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    for (const entry of this.peers.values()) {
      if (entry.sender) {
        try {
          entry.pc.removeTrack(entry.sender);
        } catch {
          // Ignore
        }
        entry.sender = null;
      }
    }
    this.enabled = false;
    this.muted = true;
    this.speaking = false;
    this.error = null;
    this.reconcilePeers();
    this.callbacks.sendVoiceState(false, true, false);
    this.emitState();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    if (muted && this.speaking) {
      this.speaking = false;
    }
    this.callbacks.sendVoiceState(this.enabled, this.muted, this.speaking);
    this.emitState();
  }

  public async toggleMic(): Promise<void> {
    if (!this.enabled) {
      await this.joinVoice(true);
      return;
    }
    this.setMuted(!this.muted);
  }

  public async handleSignal(fromId: string, rawSignal: unknown) {
    if (!this.youId || fromId === this.youId || !rawSignal || typeof rawSignal !== 'object') return;
    const signal = rawSignal as {
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

    if (!this.knownPeers.has(fromId)) {
      this.knownPeers.set(fromId, true);
    }

    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeerConnection(fromId, true);
    }

    const pc = entry.pc;
    const polite = this.youId > fromId;

    try {
      if (signal.description) {
        const desc = signal.description;
        const offerCollision =
          desc.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable');
        entry.ignoreOffer = !polite && offerCollision;
        if (entry.ignoreOffer) return;

        await pc.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            this.callbacks.sendSignal(fromId, { description: pc.localDescription });
          }
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!entry.ignoreOffer) {
            console.warn('WebRTC ICE candidate error:', err);
          }
        }
      }
    } catch (err) {
      console.warn('WebRTC signaling error:', err);
    }
  }

  public updateSpatialVolumes(
    selfPos: { x: number; y: number; z: number },
    peerPositions: Map<string, { x: number; y: number; z: number }>
  ) {
    if (this.spatialMode === 'global') return;
    for (const [peerId, entry] of this.peers) {
      const pos = peerPositions.get(peerId);
      if (!pos) {
        entry.audioEl.volume = 0.6;
        continue;
      }
      const dist = Math.hypot(selfPos.x - pos.x, selfPos.y - pos.y, selfPos.z - pos.z);
      if (dist <= 8) {
        entry.audioEl.volume = 1;
      } else if (dist >= 46) {
        entry.audioEl.volume = 0;
      } else {
        const t = 1 - (dist - 8) / 38;
        entry.audioEl.volume = Math.max(0, Math.min(1, t * t));
      }
    }
  }

  public dispose() {
    this.stopVadMonitor();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    this.cleanupAllPeers();
    this.knownPeers.clear();
    this.youId = null;
    this.enabled = false;
    this.muted = true;
    this.speaking = false;
  }

  private reconcilePeers() {
    if (!this.youId) return;
    for (const [peerId, remoteVoiceEnabled] of this.knownPeers) {
      const shouldConnect = this.enabled || remoteVoiceEnabled;
      const existing = this.peers.get(peerId);
      if (shouldConnect && !existing) {
        this.createPeerConnection(peerId, remoteVoiceEnabled);
      } else if (!shouldConnect && existing) {
        this.closePeer(peerId);
      }
    }
  }

  private createPeerConnection(peerId: string, remoteVoiceEnabled: boolean): PeerEntry {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.volume = 1;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);

    const entry: PeerEntry = {
      pc,
      audioEl,
      sender: null,
      makingOffer: false,
      ignoreOffer: false,
      remoteVoiceEnabled,
    };
    this.peers.set(peerId, entry);

    if (this.localStream) {
      this.attachLocalTrack(peerId, entry);
    } else {
      // Allow listen-only audio reception before user joins with their own mic
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {
        // Ignore if unsupported
      }
    }

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        void audioEl.play().catch(() => {
          // Autoplay will succeed once user interacts with canvas/buttons
        });
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.callbacks.sendSignal(peerId, { candidate: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          // Ignore
        }
      }
      this.emitState();
    };

    pc.onnegotiationneeded = async () => {
      if (!this.youId) return;
      // Lower ID initiates cleanly on initial connect; renegotiations proceed via polite rollback
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.callbacks.sendSignal(peerId, { description: pc.localDescription });
        }
      } catch (err) {
        console.warn('WebRTC negotiation error:', err);
      } finally {
        entry.makingOffer = false;
      }
    };

    return entry;
  }

  private attachLocalTrack(_peerId: string, entry: PeerEntry) {
    if (!this.localStream || entry.sender) return;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return;
    try {
      entry.sender = entry.pc.addTrack(track, this.localStream);
    } catch {
      // Ignore
    }
  }

  private closePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.pc.onnegotiationneeded = null;
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.onconnectionstatechange = null;
      entry.pc.close();
    } catch {
      // Ignore
    }
    try {
      entry.audioEl.srcObject = null;
      entry.audioEl.remove();
    } catch {
      // Ignore
    }
    this.peers.delete(peerId);
  }

  private cleanupAllPeers() {
    for (const id of Array.from(this.peers.keys())) {
      this.closePeer(id);
    }
  }

  private startVadMonitor(stream: MediaStream) {
    this.stopVadMonitor();
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      this.audioCtx = ctx;
      this.analyser = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let holdFrames = 0;

      this.vadTimer = window.setInterval(() => {
        if (!this.analyser || !this.enabled || this.muted) {
          if (this.speaking) {
            this.speaking = false;
            this.callbacks.sendVoiceState(this.enabled, this.muted, false);
            this.emitState();
          }
          return;
        }
        this.analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / data.length);
        if (rms > 0.022) {
          holdFrames = 4; // ~400ms smoothing tail
        } else if (holdFrames > 0) {
          holdFrames--;
        }
        const nextSpeaking = holdFrames > 0;
        if (nextSpeaking !== this.speaking) {
          this.speaking = nextSpeaking;
          this.callbacks.sendVoiceState(this.enabled, this.muted, this.speaking);
          this.emitState();
        }
      }, 100);
    } catch {
      // Ignore VAD errors if AudioContext blocked
    }
  }

  private stopVadMonitor() {
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    this.analyser = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private emitState() {
    this.callbacks.onStateChange(this.getSnapshot());
  }
}
