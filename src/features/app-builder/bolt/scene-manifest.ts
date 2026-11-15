export type SceneForm = 'portal' | 'object' | 'orbit';
export type SceneMood = 'midnight' | 'warm' | 'daylight';

export interface SceneManifest {
  version: 1;
  form: SceneForm;
  mood: SceneMood;
  accent: string;
  motion: number;
  enabled: boolean;
}

export const DEFAULT_SCENE_MANIFEST: SceneManifest = {
  version: 1,
  form: 'portal',
  mood: 'midnight',
  accent: '#53D7FF',
  motion: 0.45,
  enabled: true,
};

const FORMS: readonly SceneForm[] = ['portal', 'object', 'orbit'];
const MOODS: readonly SceneMood[] = ['midnight', 'warm', 'daylight'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function parseSceneManifest(value: unknown): SceneManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_SCENE_MANIFEST;
  const input = value as Partial<SceneManifest>;
  return {
    version: 1,
    form: FORMS.includes(input.form as SceneForm) ? (input.form as SceneForm) : DEFAULT_SCENE_MANIFEST.form,
    mood: MOODS.includes(input.mood as SceneMood) ? (input.mood as SceneMood) : DEFAULT_SCENE_MANIFEST.mood,
    accent: typeof input.accent === 'string' && HEX_COLOR.test(input.accent) ? input.accent : DEFAULT_SCENE_MANIFEST.accent,
    motion: typeof input.motion === 'number' && Number.isFinite(input.motion)
      ? Math.max(0, Math.min(1, input.motion))
      : DEFAULT_SCENE_MANIFEST.motion,
    enabled: input.enabled !== false,
  };
}

export function readSceneManifest(serialized: string | undefined): SceneManifest {
  if (!serialized) return DEFAULT_SCENE_MANIFEST;
  try {
    return parseSceneManifest(JSON.parse(serialized));
  } catch {
    return DEFAULT_SCENE_MANIFEST;
  }
}
