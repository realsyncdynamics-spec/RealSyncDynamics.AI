/**
 * Browser-Seite der Live-Stimme (Grok Realtime über `/api/company-voice/live`).
 *
 * Der Browser spricht nur mit der eigenen Origin. Er sendet PCM16-Audio
 * (24 kHz, Mono) und empfängt Audio plus Untertitel. Nichts wird gespeichert.
 * Das Mikrofon startet erst mit `startLiveVoice`, also nach dem Hinweis.
 */

export const LIVE_PATH = '/api/company-voice/live';
export const LIVE_WORKLET_PATH = '/company-voice/pcm-capture.js';
export const LIVE_RATE = 24_000;

export type LiveEndReason =
  | 'stopped'
  | 'time_limit'
  | 'unavailable'
  | 'mic_denied'
  | 'unsupported'
  | 'ended';

export interface LiveVoiceHandlers {
  onReady: (info: { maxSeconds: number; greeting: string }) => void;
  onUser: (text: string, final: boolean) => void;
  onAssistantDelta: (text: string) => void;
  onAssistantDone: (text: string) => void;
  onEnd: (reason: LiveEndReason) => void;
}

export interface LiveVoiceSession {
  stop: () => void;
}

export type StartLiveVoice = (handlers: LiveVoiceHandlers) => LiveVoiceSession;

export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
  }
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function pcm16Base64ToFloat(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const count = Math.floor(binary.length / 2);
  const out = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    const value = (high << 8) | low;
    out[index] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
  }
  return out;
}

export function liveVoiceSupported(target: Window = window): boolean {
  const scope = target as unknown as {
    navigator?: { mediaDevices?: { getUserMedia?: unknown } };
    AudioContext?: unknown;
    AudioWorkletNode?: unknown;
    WebSocket?: unknown;
  };
  return (
    typeof scope.navigator?.mediaDevices?.getUserMedia === 'function' &&
    typeof scope.AudioContext === 'function' &&
    typeof scope.AudioWorkletNode === 'function' &&
    typeof scope.WebSocket === 'function'
  );
}

export function liveSocketUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  return `${location.protocol === 'http:' ? 'ws:' : 'wss:'}//${location.host}${LIVE_PATH}`;
}

/**
 * Startet Mikrofon, Verbindung und Wiedergabe. Meldet genau einmal `onEnd`.
 * Fehler vor `onReady` enden mit `unavailable`, `mic_denied` oder `unsupported`.
 */
export const startLiveVoice: StartLiveVoice = (handlers) => {
  let ended = false;
  let ready = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let socket: WebSocket | null = null;
  let playhead = 0;
  const playing = new Set<AudioBufferSourceNode>();

  const flushPlayback = () => {
    for (const source of playing) {
      try {
        source.stop();
      } catch {
        /* schon beendet */
      }
    }
    playing.clear();
    playhead = 0;
  };

  const end = (reason: LiveEndReason) => {
    if (ended) return;
    ended = true;
    flushPlayback();
    stream?.getTracks().forEach((track) => track.stop());
    try {
      socket?.close();
    } catch {
      /* schon zu */
    }
    void context?.close().catch(() => undefined);
    handlers.onEnd(reason);
  };

  const play = (base64: string) => {
    if (!context) return;
    const samples = pcm16Base64ToFloat(base64);
    if (samples.length === 0) return;
    const buffer = context.createBuffer(1, samples.length, LIVE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, playhead);
    source.start(startAt);
    playhead = startAt + buffer.duration;
    playing.add(source);
    source.onended = () => playing.delete(source);
  };

  const onMessage = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    let message: { type?: unknown; [key: string]: unknown };
    try {
      message = JSON.parse(raw) as { type?: unknown };
    } catch {
      return;
    }
    const text = typeof message.text === 'string' ? message.text : '';
    switch (message.type) {
      case 'ready':
        ready = true;
        handlers.onReady({
          maxSeconds: typeof message.maxSeconds === 'number' ? message.maxSeconds : 0,
          greeting: typeof message.greeting === 'string' ? message.greeting : '',
        });
        return;
      case 'audio':
        if (typeof message.audio === 'string') play(message.audio);
        return;
      case 'speech_started':
        // Nutzer spricht dazwischen: laufende Antwort sofort stumm.
        flushPlayback();
        return;
      case 'user':
        handlers.onUser(text, message.final === true);
        return;
      case 'assistant.delta':
        handlers.onAssistantDelta(text);
        return;
      case 'assistant.done':
        handlers.onAssistantDone(text);
        return;
      case 'closed':
        end(message.reason === 'time_limit' ? 'time_limit' : ready ? 'ended' : 'unavailable');
        return;
      default:
        return;
    }
  };

  const run = async () => {
    if (!liveVoiceSupported()) {
      end('unsupported');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      end('mic_denied');
      return;
    }
    if (ended) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    let capture: AudioWorkletNode;
    let source: MediaStreamAudioSourceNode;
    try {
      context = new AudioContext({ sampleRate: LIVE_RATE });
      await context.audioWorklet.addModule(LIVE_WORKLET_PATH);
      source = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, 'pcm-capture');
    } catch {
      end('unsupported');
      return;
    }
    if (ended) return;

    try {
      socket = new WebSocket(liveSocketUrl(window.location));
    } catch {
      end('unavailable');
      return;
    }
    const ws = socket;
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!ready || ended || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'audio', audio: floatToPcm16Base64(event.data) }));
    };
    // Der Worklet-Knoten hat keinen hörbaren Ausgang; kein Echo des Mikrofons.
    source.connect(capture);
    ws.onmessage = (event) => onMessage(event.data);
    ws.onerror = () => end(ready ? 'ended' : 'unavailable');
    ws.onclose = () => end(ready ? 'ended' : 'unavailable');
  };

  void run();

  return {
    stop: () => {
      try {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
      } catch {
        /* Verbindung ist weg */
      }
      end('stopped');
    },
  };
};
