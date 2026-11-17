/**
 * Regie-Agent, Schritt 1: aus einem Briefing einen ausführbaren Plan machen.
 *
 * Der Planer ist bewusst deterministisch: gleiche Eingabe → gleicher Plan.
 * Er entscheidet selbst (agentisch) über Anbieter, Reihenfolge, Seitenverhältnis
 * und Verkettung (Bild als Keyframe für das Video) — auf Basis dessen, was der
 * Server für diesen Mandanten als verfügbar meldet. Ein LLM-Planer kann später
 * dieselbe `Plan`-Struktur liefern; Freigabe und Ausführung bleiben gleich.
 */
import type { AspectRatio, MediaKind, MediaProviderId } from '../../../../supabase/functions/_shared/mediaStudio/catalog';

export type UseCase = 'landing_hero' | 'service_tiles' | 'social_clip' | 'product_shot' | 'custom';
export type StyleId = 'photo' | 'cinematic' | 'clean_3d' | 'illustration';

export const USE_CASES: { id: UseCase; label: string; hint: string }[] = [
  { id: 'landing_hero', label: 'Hero für Landingpage', hint: 'Breites Titelbild mit Platz für die Überschrift, optional bewegt.' },
  { id: 'service_tiles', label: 'Leistungs-Kacheln', hint: 'Bis zu vier Bilder, eins je Leistung (Kommas oder Zeilen trennen).' },
  { id: 'social_clip', label: 'Social-Clip (Hochformat)', hint: 'Keyframe + kurzes 9:16-Video für Reels/Shorts.' },
  { id: 'product_shot', label: 'Produkt-/Werkstück-Shot', hint: 'Freigestelltes Studio-Motiv, optional als Orbit-Video.' },
  { id: 'custom', label: 'Freies Motiv', hint: 'Ihr Text wird direkt als Motiv verwendet.' },
];

export const STYLES: { id: StyleId; label: string; phrase: string }[] = [
  { id: 'photo', label: 'Fotorealistisch', phrase: 'Photorealistic, natural light, authentic textures, 35mm lens.' },
  { id: 'cinematic', label: 'Cinematisch', phrase: 'Cinematic color grading, dramatic but natural lighting, shallow depth of field.' },
  { id: 'clean_3d', label: 'Clean 3D', phrase: 'Clean 3D render, soft studio lighting, minimal background.' },
  { id: 'illustration', label: 'Illustration', phrase: 'Flat editorial illustration, limited color palette, clean shapes.' },
];

/** Gilt für jeden Schritt: keine Schrift im Bild, keine echten Personen nachbilden. */
export const DEFAULT_NEGATIVE =
  'text, letters, logos, watermarks, recognizable real people or celebrities, distorted hands';

export interface Brief {
  goal: string;
  useCase: UseCase;
  industry: string;
  style: StyleId;
  aspect: AspectRatio;
  withVideo: boolean;
  camera?: string;
  durationS?: number;
}

/** Das, was der Server unter `capabilities` meldet (Ausschnitt). */
export interface ModelAvailability {
  provider: MediaProviderId;
  kind: MediaKind;
  label: string;
  available: boolean;
  reason: string | null;
  aspect_ratios: readonly AspectRatio[];
  duration_s: { min: number; max: number; default: number } | null;
  accepts_reference: 'none' | 'inline' | 'url';
  delivery: 'sync' | 'async';
}

export type StepStatus = 'planned' | 'running' | 'waiting' | 'done' | 'failed' | 'skipped';

export interface StudioAsset {
  kind: MediaKind;
  mime_type: string;
  data_base64?: string;
  url?: string;
  sig: string;
}

export interface PlanStep {
  id: string;
  kind: MediaKind;
  title: string;
  provider: MediaProviderId;
  prompt: string;
  negativePrompt: string;
  aspect: AspectRatio;
  durationS?: number;
  camera?: string;
  /** Schritt-ID, deren erstes Ergebnis als Referenzbild dient. */
  referenceFrom?: string;
  status: StepStatus;
  error?: string;
  assets?: StudioAsset[];
  model?: string;
  requestId?: string;
}

export interface Plan {
  brief: Brief;
  steps: PlanStep[];
  /** Begründungen des Agenten (Routing, Anpassungen) — für den Nutzer sichtbar. */
  notes: string[];
  approvedAt: number | null;
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; reason: string };

const IMAGE_PROVIDER_ORDER: MediaProviderId[] = ['google', 'higgsfield'];

function avail(models: ModelAvailability[], provider: MediaProviderId, kind: MediaKind) {
  return models.find((m) => m.provider === provider && m.kind === kind && m.available);
}

function styleOf(id: StyleId): string {
  return STYLES.find((s) => s.id === id)?.phrase ?? '';
}

function industryText(industry: string): string {
  const t = industry.trim();
  return t ? `${t} business` : 'small local business';
}

/** Zerlegt „Dachsanierung, Dachrinne; Solar“ in Einzelleistungen (max. 4). */
export function splitServices(goal: string): string[] {
  return goal
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .slice(0, 4);
}

function nearestVideoAspect(aspect: AspectRatio, supported: readonly AspectRatio[]): AspectRatio {
  if (supported.includes(aspect)) return aspect;
  const portrait = aspect === '9:16' || aspect === '3:4';
  const pick = portrait ? '9:16' : '16:9';
  return supported.includes(pick) ? pick : supported[0];
}

interface ImageSpec {
  title: string;
  prompt: string;
}

function imageSpecs(brief: Brief): ImageSpec[] {
  const who = industryText(brief.industry);
  const style = styleOf(brief.style);
  const goal = brief.goal.trim();
  switch (brief.useCase) {
    case 'landing_hero':
      return [{
        title: 'Hero-Bild',
        prompt: `Wide website hero image for a ${who}: ${goal}. ${style} Calm composition with clear negative space on the left for a headline.`,
      }];
    case 'service_tiles': {
      const services = splitServices(goal);
      const list = services.length > 0 ? services : ['tools and materials in detail', 'craftsperson at work', 'finished result'];
      return list.map((s, i) => ({
        title: `Kachel ${i + 1}: ${s.slice(0, 40)}`,
        prompt: `Service tile image for a ${who}, showing: ${s}. ${style} Single clear subject, consistent framing.`,
      }));
    }
    case 'social_clip':
      return [{
        title: 'Keyframe Social-Clip',
        prompt: `Vertical social media keyframe for a ${who}: ${goal}. ${style} Strong foreground subject, dynamic angle.`,
      }];
    case 'product_shot':
      return [{
        title: 'Produkt-Shot',
        prompt: `Studio product shot for a ${who}: ${goal}. ${style} Isolated on a neutral seamless background, soft shadow.`,
      }];
    case 'custom':
    default:
      return [{ title: 'Motiv', prompt: `${goal}. ${style}`.trim() }];
  }
}

function defaultCamera(useCase: UseCase): string {
  if (useCase === 'product_shot') return 'orbit';
  if (useCase === 'social_clip') return 'handheld';
  return 'dolly_in';
}

export function planFromBrief(brief: Brief, models: ModelAvailability[]): PlanResult {
  if (brief.goal.trim().length < 3) return { ok: false, reason: 'Bitte beschreiben Sie das Motiv (mindestens ein paar Wörter).' };

  const notes: string[] = [];
  const imageProvider = IMAGE_PROVIDER_ORDER.find((p) => avail(models, p, 'image'));
  if (!imageProvider) {
    const why = models.find((m) => m.kind === 'image')?.reason;
    return { ok: false, reason: `Kein Bildmodell verfügbar.${why ? ` ${why}` : ''}` };
  }
  const imageModel = avail(models, imageProvider, 'image')!;

  // Video-Routing: das Video muss das Keyframe des Bildschritts annehmen können.
  // Google-Bild (inline) → Google-Video; Higgsfield-Bild (URL) → Higgsfield-Video.
  let videoProvider: MediaProviderId | undefined;
  let chain = false;
  if (brief.withVideo) {
    const sameProvider = avail(models, imageProvider, 'video');
    if (sameProvider && sameProvider.accepts_reference !== 'none') {
      videoProvider = imageProvider;
      chain = true;
    } else {
      const any = models.find((m) => m.kind === 'video' && m.available);
      if (any) {
        videoProvider = any.provider;
        notes.push(`Video läuft über ${any.label} ohne Keyframe, weil das Bild von einem anderen Anbieter kommt.`);
      } else {
        notes.push('Kein Videomodell verfügbar — der Plan enthält nur Bilder.');
      }
    }
  }
  const videoModel = videoProvider ? avail(models, videoProvider, 'video') : undefined;

  let imageAspect = brief.aspect;
  if (brief.useCase === 'social_clip') imageAspect = '9:16';
  if (brief.useCase === 'product_shot' && !brief.withVideo) imageAspect = '1:1';
  let videoAspect: AspectRatio | undefined;
  if (videoModel) {
    videoAspect = nearestVideoAspect(imageAspect, videoModel.aspect_ratios);
    if (chain && videoAspect !== imageAspect) {
      notes.push(`Bild auf ${videoAspect} umgestellt, damit es als Keyframe für das Video passt.`);
      imageAspect = videoAspect;
    }
  }
  if (!imageModel.aspect_ratios.includes(imageAspect)) {
    notes.push(`${imageAspect} wird von ${imageModel.label} nicht unterstützt — 16:9 verwendet.`);
    imageAspect = '16:9';
  }

  const negative = DEFAULT_NEGATIVE;
  const steps: PlanStep[] = imageSpecs(brief).map((spec, i) => ({
    id: `img-${i + 1}`,
    kind: 'image',
    title: spec.title,
    provider: imageProvider,
    prompt: spec.prompt,
    negativePrompt: negative,
    aspect: imageAspect,
    status: 'planned',
  }));
  notes.unshift(`Bilder über ${imageModel.label}${imageModel.delivery === 'async' ? ' (Auftrag mit Statusabfrage)' : ''}.`);

  if (videoModel && videoProvider && videoAspect) {
    const range = videoModel.duration_s ?? { min: 3, max: 8, default: 5 };
    const wanted = brief.durationS ?? range.default;
    const durationS = Math.min(range.max, Math.max(range.min, Math.round(wanted)));
    if (durationS !== wanted) notes.push(`Videodauer auf ${durationS} s angepasst (${videoModel.label}: ${range.min}–${range.max} s).`);
    steps.push({
      id: 'vid-1',
      kind: 'video',
      title: chain ? 'Video aus Keyframe' : 'Video',
      provider: videoProvider,
      prompt: chain
        ? `Bring this exact scene to life with subtle, realistic motion. Keep composition, colors and subject unchanged. ${styleOf(brief.style)}`
        : `${imageSpecs(brief)[0].prompt} Subtle, realistic motion.`,
      negativePrompt: negative,
      aspect: videoAspect,
      durationS,
      camera: brief.camera ?? defaultCamera(brief.useCase),
      referenceFrom: chain ? steps[0].id : undefined,
      status: 'planned',
    });
  }

  return { ok: true, plan: { brief, steps, notes, approvedAt: null } };
}

export interface PlanSummary {
  images: number;
  videos: number;
  videoSeconds: number;
  providers: MediaProviderId[];
}

/** Was die Freigabe auslöst — wird vor dem Ausführen angezeigt. */
export function summarizePlan(plan: Plan): PlanSummary {
  const active = plan.steps.filter((s) => s.status !== 'skipped');
  return {
    images: active.filter((s) => s.kind === 'image').length,
    videos: active.filter((s) => s.kind === 'video').length,
    videoSeconds: active.filter((s) => s.kind === 'video').reduce((n, s) => n + (s.durationS ?? 0), 0),
    providers: [...new Set(active.map((s) => s.provider))],
  };
}

export function approvePlan(plan: Plan, now: number): Plan {
  return { ...plan, approvedAt: now };
}

/** Jede inhaltliche Änderung nach der Freigabe hebt sie auf. */
export function updateStep(plan: Plan, stepId: string, patch: Partial<Pick<PlanStep, 'prompt' | 'negativePrompt' | 'camera' | 'durationS'>>): Plan {
  return {
    ...plan,
    approvedAt: null,
    steps: plan.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
  };
}
