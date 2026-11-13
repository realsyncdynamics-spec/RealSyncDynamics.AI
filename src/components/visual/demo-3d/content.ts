import type { HotspotDef } from './archScene';

/** Inhalte der Demo – fiktives Unternehmen, keine echte Referenz. */
export const COMPANY = {
  name: 'Atelier Nordlicht',
  tagline: 'Architektur für Licht, Raum und Zukunft',
};

export interface HotspotContent extends HotspotDef {
  title: string;
  text: string;
  facts: string[];
}

export const HOTSPOTS: HotspotContent[] = [
  {
    id: 'fassade',
    label: 'Glasfassade',
    position: [1.55, 2.6, 0.9],
    title: 'Dreifach verglaste Fassade',
    text: 'Raumhohe Verglasung holt Tageslicht tief ins Gebäude. Außenliegende Lamellen regeln Blendung und Wärmeeintrag.',
    facts: ['Tageslichtorientierte Planung', 'Außenliegender Sonnenschutz', 'Beispielinhalt der Demo'],
  },
  {
    id: 'atrium',
    label: 'Lichtatrium',
    position: [0, 1.15, 1.45],
    title: 'Offenes Lichtatrium',
    text: 'Das Atrium verbindet alle Ebenen und dient als Treffpunkt, Ausstellungsfläche und natürlicher Luftkanal.',
    facts: ['Sichtbeziehungen über drei Ebenen', 'Flexible Ausstellungsfläche'],
  },
  {
    id: 'dach',
    label: 'Dachgarten',
    position: [-0.6, 3.75, -0.2],
    title: 'Begrünter Dachgarten',
    text: 'Extensive Begrünung speichert Regenwasser, kühlt im Sommer und schafft einen ruhigen Außenraum.',
    facts: ['Regenwasserrückhalt', 'Aufenthaltsfläche für das Team'],
  },
  {
    id: 'energie',
    label: 'Energiesystem',
    position: [-1.9, 0.35, 0.6],
    title: 'Eigenes Energiesystem',
    text: 'Photovoltaik und Wärmepumpe versorgen das Gebäude. Die Darstellung ist ein vereinfachtes Demo-Modell.',
    facts: ['Photovoltaikfeld', 'Wärmepumpe (schematisch)'],
  },
];

export const SECTIONS = [
  {
    id: 'raum',
    kicker: '01 · Raum',
    title: 'Räume, die Licht lenken',
    text: 'Auskragende Geschossplatten erzeugen geschützte Terrassen und tiefe Ausblicke. Scrolle weiter – die Kamera folgt dem Gebäude.',
  },
  {
    id: 'material',
    kicker: '02 · Material',
    title: 'Glas, Beton, Stahl',
    text: 'Reduzierte Materialien, präzise gefügt. Klicke auf die Markierungen im Modell, um Details zu öffnen.',
  },
  {
    id: 'zukunft',
    kicker: '03 · Zukunft',
    title: 'Gebaut für morgen',
    text: 'Dachgarten, Tageslicht und ein eigenes Energiesystem. Passe Farben, Licht und Stimmung im Konfigurator an.',
  },
];
