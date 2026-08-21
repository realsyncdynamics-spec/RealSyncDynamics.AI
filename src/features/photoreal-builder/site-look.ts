import { DESIGN_VARIANTS, type DesignVariantId } from './design-variants';

export type SiteLook = {
  variantId: DesignVariantId;
  headline: string;
  lead: string;
  cta: string;
  accent: string;
  hero: string;
  photos: string[];
  prompt: string;
  kicker: string;
  showServices: boolean;
};

export const ACCENTS = [
  { id: 'forest', hex: '#3f5c4d', label: 'Wald' },
  { id: 'rust', hex: '#8a3d24', label: 'Rost' },
  { id: 'brass', hex: '#c4a574', label: 'Messing' },
  { id: 'sea', hex: '#1d4e5f', label: 'See' },
  { id: 'ink', hex: '#1a1610', label: 'Tinte' },
];

export const HEROES = [
  { src: '/landings/hero-minimal.jpg', label: 'Licht' },
  { src: '/landings/hero-bento.jpg', label: 'Architektur' },
  { src: '/landings/hero-dark.jpg', label: 'Nacht' },
  { src: '/landings/hero-spa.jpg', label: 'Ruhe' },
  { src: '/landings/still-atelier.jpg', label: 'Werkstatt' },
  { src: '/landings/detail-court.jpg', label: 'Hof' },
];

export const SCENE_PRESETS = [
  { id: 'skyline', label: 'Skyline', still: '/landings/hero-dark.jpg', prompt: 'Photoreal city skyline at dusk, glass towers, wet streets, cinematic teal and amber, Hasselblad, no text' },
  { id: 'natur', label: 'Natur', still: '/landings/hero-minimal.jpg', prompt: 'Photoreal misty forest clearing at sunrise, wet moss, raking light, medium format, no people, no text' },
  { id: 'buero', label: 'Büro', still: '/landings/detail-desk.jpg', prompt: 'Photoreal modern office interior, oak desk, city bokeh through glass, brass lamp, cinematic, no people, no text' },
  { id: 'werkstatt', label: 'Werkstatt', still: '/landings/still-atelier.jpg', prompt: 'Photoreal craft workshop, worn wood bench, tools in raking morning light, tactile dust, Hasselblad, no text' },
  { id: 'kueche', label: 'Küche', still: '/landings/still-food.jpg', prompt: 'Photoreal restaurant kitchen pass, steel and steam, warm tungsten, editorial food photography, no logos, no text' },
  { id: 'hotel', label: 'Hotel', still: '/landings/still-hospitality.jpg', prompt: 'Photoreal hotel lobby, stone, linen, one warm lamp, dusk courtyard beyond glass, architectural photography, no text' },
  { id: 'praxis', label: 'Praxis', still: '/landings/still-praxis.jpg', prompt: 'Photoreal calm medical practice waiting room, pale oak, linen, morning window light, no people, no text' },
  { id: 'laden', label: 'Laden', still: '/landings/hero-bento.jpg', prompt: 'Photoreal small European shop interior, wooden shelves, daylight from the street, tactile goods, no logos, no text' },
] as const;

export function stillFromPrompt(prompt: string): { still: string; accent: string; variantId: DesignVariantId } {
  const s = prompt.toLowerCase();
  if (/skyline|stadt|city|dämmerung|daemmerung|nacht|glass/.test(s)) {
    return { still: '/landings/hero-dark.jpg', accent: '#c4a574', variantId: 'dark-professional' };
  }
  if (/natur|wald|moos|forest|wiese/.test(s)) {
    return { still: '/landings/hero-minimal.jpg', accent: '#3f5c4d', variantId: 'modern-minimal' };
  }
  if (/büro|buero|office|schreibtisch|desk/.test(s)) {
    return { still: '/landings/detail-desk.jpg', accent: '#1d4e5f', variantId: 'dark-professional' };
  }
  if (/werkstatt|atelier|holz|handwerk/.test(s)) {
    return { still: '/landings/still-atelier.jpg', accent: '#3f5c4d', variantId: 'modern-minimal' };
  }
  if (/küche|kueche|food|gastro|restaurant/.test(s)) {
    return { still: '/landings/still-food.jpg', accent: '#8a3d24', variantId: 'bento-bold' };
  }
  if (/hotel|lobby|leinen|spa/.test(s)) {
    return { still: '/landings/still-hospitality.jpg', accent: '#c4a574', variantId: 'dark-professional' };
  }
  if (/praxis|arzt|klinik|warte/.test(s)) {
    return { still: '/landings/still-praxis.jpg', accent: '#3f5c4d', variantId: 'modern-minimal' };
  }
  if (/laden|shop|regal/.test(s)) {
    return { still: '/landings/hero-bento.jpg', accent: '#8a3d24', variantId: 'bento-bold' };
  }
  return { still: '/landings/hero-minimal.jpg', accent: '#3f5c4d', variantId: 'modern-minimal' };
}

export function emptyLook(): SiteLook {
  const v = DESIGN_VARIANTS[0];
  return {
    variantId: v.id,
    headline: '',
    lead: '',
    cta: 'Gespräch anfragen',
    accent: v.tokens.accent,
    hero: v.hero,
    photos: [],
    prompt: '',
    kicker: '',
    showServices: true,
  };
}
