/**
 * STOP-Punkt 2 aus `docs/architecture/policy-verdict-audit.md` §7.
 *
 * `website-domain-manager` arbeitet mit Service-Role und umgeht damit RLS.
 * Die Mandantengrenze muss die Function selbst ziehen — das Gateway prüft
 * nur, *dass* ein gültiges JWT vorliegt, nicht *wessen*.
 *
 * Die Function läuft in Deno und lässt sich hier nicht ausführen. Prüfbar ist
 * die Quelle, und zwar auf die zwei Eigenschaften, die den Befund ausmachten:
 *
 *   1. `tenant_id` aus dem Body darf nur als *Behauptung* in die
 *      Mitgliedschaftsprüfung gehen, nie als Wert in einen Zugriff.
 *   2. `domain` aus dem Body darf keine Zeile ausserhalb des eigenen Projekts
 *      erreichen. Das war der schwerere Teil: Für `check-ssl` und den zweiten
 *      Schreibzugriff in `validate-domain` genügten dem Angreifer die
 *      *eigenen*, vollständig gültigen Zugangsdaten — er musste keine fremde
 *      ID kennen.
 *
 * Ein Test auf das Verhalten gäbe es hier nicht: Beide Defekte sahen aus wie
 * funktionierender Code und lieferten für den ehrlichen Aufrufer das richtige
 * Ergebnis. Sichtbar sind sie nur an der Form der Abfrage.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const PFAD = 'supabase/functions/website-domain-manager/index.ts';
const src = readFileSync(PFAD, 'utf8');

/** Alle Zugriffsketten auf eine Tabelle, mit ihrem vorangehenden Kontext. */
function ketten(tabelle: string): Array<{ kette: string; davor: string }> {
  const marke = `.from('${tabelle}')`;
  const treffer: Array<{ kette: string; davor: string }> = [];
  let i = src.indexOf(marke);
  while (i !== -1) {
    const ende = src.indexOf(';', i);
    treffer.push({
      kette: src.slice(i, ende === -1 ? src.length : ende),
      davor: src.slice(Math.max(0, i - 500), i),
    });
    i = src.indexOf(marke, i + marke.length);
  }
  return treffer;
}

describe('website-domain-manager zieht die Mandantengrenze selbst', () => {
  it('nutzt den gemeinsamen Wächter statt einer eigenen Prüfung', () => {
    expect(src).toMatch(/import\s*\{[^}]*requireAuthAndTenant[^}]*\}\s*from\s*'\.\.\/_shared\/auth\.ts'/);
    expect(src).toContain('requireAuthAndTenant(req, body.tenant_id)');
  });

  it('legt keinen Service-Role-Client an, bevor die Mitgliedschaft feststeht', () => {
    // Der Client kommt ausschliesslich aus dem AuthContext. Ein eigener
    // createClient mit dem Service-Role-Key wäre schon vor der Prüfung
    // privilegiert.
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(src).not.toMatch(/createClient\s*\(/);
  });

  it('verwendet body.tenant_id ausschliesslich als Behauptung', () => {
    // Genau eine Fundstelle: das Argument der Mitgliedschaftsprüfung. Jede
    // weitere wäre ein Zugriff auf einen ungeprüften Wert.
    const fundstellen = src.match(/body\.tenant_id/g) ?? [];
    expect(fundstellen).toHaveLength(1);
    expect(src).toContain('requireAuthAndTenant(req, body.tenant_id)');
  });

  it('sucht das Projekt im geprüften Mandanten', () => {
    const [projekt, ...weitere] = ketten('website_projects');
    expect(projekt).toBeDefined();
    expect(weitere).toHaveLength(0);
    expect(projekt.kette).toContain(".eq('id', body.project_id)");
    expect(projekt.kette).toContain(".eq('tenant_id', tenantId)");
  });

  it('grenzt jeden Zugriff auf website_domains über project_id ein', () => {
    const alle = ketten('website_domains');
    // Vier Aktionen, fünf lesende/schreibende Ketten plus die globale
    // Eindeutigkeitsprüfung. Sinkt die Zahl, ist eine Aktion entfallen;
    // steigt sie, kam eine ungeprüfte hinzu.
    expect(alle.length).toBeGreaterThanOrEqual(6);

    for (const { kette, davor } of alle) {
      // Eine bewusst globale Abfrage muss sich unmittelbar davor als solche
      // ausweisen — sonst ist „vergessen" von „entschieden" nicht zu
      // unterscheiden.
      if (davor.includes('// GLOBAL:')) continue;

      if (kette.includes('.insert(')) {
        expect(kette, `insert ohne project_id: ${kette}`).toContain('project_id: projectId');
        expect(kette, `insert ohne tenant_id: ${kette}`).toContain('tenant_id: tenantId');
        continue;
      }

      expect(kette, `Kette ohne project_id-Eingrenzung: ${kette}`).toContain(
        ".eq('project_id', projectId)",
      );
    }
  });

  it('erlaubt genau eine bewusst globale Abfrage — die Eindeutigkeit der Domain', () => {
    const global = ketten('website_domains').filter((k) => k.davor.includes('// GLOBAL:'));
    expect(global).toHaveLength(1);
    // Sie darf nur die Existenz beantworten, keine fremden Felder ausliefern.
    expect(global[0].kette).toContain(".select('id')");
  });

  it('klärt die Zugehörigkeit, bevor validate-domain nach aussen telefoniert', () => {
    const anfang = src.indexOf('async function validateDomain(');
    const ende = src.indexOf('async function disconnectDomain(');
    expect(anfang).toBeGreaterThan(-1);
    expect(ende).toBeGreaterThan(anfang);
    const rumpf = src.slice(anfang, ende);

    const besitz = rumpf.indexOf(".eq('project_id', projectId)");
    const dns = rumpf.indexOf('checkDNSPropagation(');
    expect(besitz).toBeGreaterThan(-1);
    expect(dns).toBeGreaterThan(-1);
    // Sonst löst eine fremde Domain im Body einen ausgehenden Aufruf aus,
    // bevor überhaupt feststeht, dass sie den Aufrufer etwas angeht.
    expect(besitz).toBeLessThan(dns);
  });

  it('gibt bei fremder oder unbekannter Domain nichts preis', () => {
    // Beide Nachschlagewege enden im selben Code — „gehört dir nicht" und
    // „gibt es nicht" dürfen von aussen nicht unterscheidbar sein.
    const treffer = src.match(/code: 'DOMAIN_NOT_FOUND'/g) ?? [];
    expect(treffer.length).toBeGreaterThanOrEqual(2);
  });
});
