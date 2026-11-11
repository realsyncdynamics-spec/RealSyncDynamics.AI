/**
 * Stimme der Demo.
 *
 * Standard ist die Web Speech API des Browsers (kostenlos, kein Konto).
 * ElevenLabs ist ein Adapter-Platzhalter und bleibt aus: kein SDK, kein Key,
 * kein neuer Account. `VITE_ELEVENLABS_BROWSER_ENABLED=true` ändert die
 * Ausgabe nicht, solange dieses Modul kein SDK lädt.
 */

export type ElevenLabsAdapterState = 'disabled' | 'not-bundled';

export interface VoiceOutputSelection {
  engine: 'web-speech';
  elevenLabs: ElevenLabsAdapterState;
}

export function selectVoiceOutput(input?: {
  elevenLabsEnabled?: boolean;
  elevenLabsAgentId?: string | null;
}): VoiceOutputSelection {
  if (input?.elevenLabsEnabled === true) {
    // Agent-ID wird bewusst nicht gelesen und nicht gesprochen.
    void input.elevenLabsAgentId;
    return { engine: 'web-speech', elevenLabs: 'not-bundled' };
  }
  return { engine: 'web-speech', elevenLabs: 'disabled' };
}

export function elevenLabsFlagFromEnv(value: unknown): boolean {
  return value === 'true';
}

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

export function microphoneAllowed(doc: Document = document): boolean {
  const policy = (doc as Document & {
    permissionsPolicy?: { allowsFeature?: (name: string) => boolean };
    featurePolicy?: { allowsFeature?: (name: string) => boolean };
  }).permissionsPolicy ?? (doc as Document & { featurePolicy?: { allowsFeature?: (name: string) => boolean } }).featurePolicy;
  if (!policy?.allowsFeature) return true;
  try {
    return policy.allowsFeature('microphone');
  } catch {
    return true;
  }
}

export function createRecognition(target: SpeechWindow = window): BrowserSpeechRecognition | null {
  const Ctor = target.SpeechRecognition ?? target.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'de-DE';
  recognition.interimResults = true;
  recognition.continuous = false;
  return recognition;
}

export function speakGerman(text: string, synth: SpeechSynthesis | null | undefined): SpeechSynthesisUtterance | null {
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return null;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  synth.speak(utterance);
  return utterance;
}

export function stopSpeaking(synth: SpeechSynthesis | null | undefined): void {
  synth?.cancel();
}
