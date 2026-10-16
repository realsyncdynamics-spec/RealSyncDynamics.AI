export function sandpackPreviewEnabled(value: unknown = import.meta.env.VITE_APP_BUILDER_SANDPACK): boolean {
  return value === 'true';
}

export const SANDPACK_PREVIEW_ENABLED = sandpackPreviewEnabled();
