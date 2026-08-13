// TypeScript compatibility for the SiteOS audit UI.
// ScoreBreakdown is structurally a score object, but the UI also indexes
// its stable score keys dynamically. Keep that contract explicit here.
declare module '../packages/siteos-core/src/types.ts' {
  interface ScoreBreakdown {
    [key: string]: unknown;
  }
}
