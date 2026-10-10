/** Minimaler className-Joiner für die Brand-Komponenten. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
