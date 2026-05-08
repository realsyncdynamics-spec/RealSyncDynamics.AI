// Barrel-Export der PDF-Templates. Wird in DokumenteBundle.tsx via
// dynamischem import() geladen, damit @react-pdf/renderer (~150 kB) nicht
// im Hauptbundle landet sondern erst beim Klick auf „PDF generieren".
export { DSETemplate } from './templates/DSETemplate';
export { AVVTemplate } from './templates/AVVTemplate';
export { VVTTemplate } from './templates/VVTTemplate';
export { TOMTemplate } from './templates/TOMTemplate';
export { DSFATemplate } from './templates/DSFATemplate';
export type { DocMeta } from './shared';
export { DOCS_VERSION } from './shared';
