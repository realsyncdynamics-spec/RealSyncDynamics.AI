import type { SiteDiscovery } from './types';

export type BotFacts = {
  company: string;
  host: string;
  description: string;
  services: { title: string; description: string }[];
  emails: string[];
  phones: string[];
  address: string | null;
  hours: string | null;
  vacations: string | null;
  hasImpressum: boolean;
  hasDatenschutz: boolean;
};

export type BotReply = {
  text: string;
  kind: "answer" | "booking" | "handoff" | "refuse" | "legal" | "system";
  evidence: string;
  slots?: string[];
};

export function factsFromDiscovery(model: SiteDiscovery): BotFacts {
  return {
    company: model.company,
    host: model.host,
    description: model.description,
    services: model.services.map((s) => ({ title: s.title, description: s.description })),
    emails: model.emails,
    phones: model.phones,
    address: model.address,
    hours: model.hours,
    vacations: null,
    hasImpressum: model.hasImpressum,
    hasDatenschutz: model.hasDatenschutz,
  };
}

export const BOT_POLICY = {
  aiAct: "limited" as const,
  article50: true,
  euHosted: true,
  transfer: "eu-internal" as const,
  training: false,
  purpose: "Kundenanfrage und Terminverwaltung",
};

function inVacation(key: string, raw: string | null) {
  if (!raw) return false;
  return raw.split(";").some((span) => {
    const m = span.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] <= key && key <= m[2] : false;
  });
}

function slots(facts: BotFacts) {
  const out: string[] = [];
  const times = ["10:00", "14:30"];
  for (let d = 1; d <= 12 && out.length < 6; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    if (dt.getDay() === 0) continue;
    const key = dt.toISOString().slice(0, 10);
    if (inVacation(key, facts.vacations)) continue;
    const day = dt.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
    times.forEach((tm) => {
      if (out.length < 6) out.push(`${day} ${tm}`);
    });
  }
  return out;
}

export function reply(facts: BotFacts, raw: string): BotReply {
  const q = raw.trim().toLowerCase();
  if (!q) {
    return {
      text: `Ich bin der Assistent von ${facts.company}. KI-System, begrenztes Risiko (EU AI Act Art. 50). EU-gehostet, keine Trainingsnutzung. Wobei kann ich helfen — Frage oder Termin?`,
      kind: "system",
      evidence: "bot.session.opened",
    };
  }
  if (/mensch|person|mitarbeiter|hotline|anrufen/.test(q)) {
    const phone = facts.phones[0] ? ` Telefon: ${facts.phones[0]}.` : " Telefon steht nicht in der Quelle.";
    return {
      text: `Ich verbinde nicht selbst. Ein Mensch nimmt über die Kontaktdaten aus der Quelle auf.${phone}`,
      kind: "handoff",
      evidence: "bot.handoff.requested",
    };
  }
  if (/lösch|loesch|vergiss|daten raus|auskunft/.test(q)) {
    return {
      text: "Diese Unterhaltung liegt nur in Ihrem Browser. Schließen Sie das Fenster — die Chatdaten sind weg. Server-Kopien legt dieser Bot nicht an. Auskunft/Löschung zu gespeicherten Terminen: schriftlich an die im Impressum genannte Stelle.",
      kind: "legal",
      evidence: "bot.dsr.explained",
    };
  }
  if (/impressum|datenschutz|dsgvo|ai act|ki-gesetz/.test(q)) {
    const imp = facts.hasImpressum ? "Impressum in der Quelle vorhanden." : "Impressum: NEEDS CUSTOMER INPUT.";
    const dse = facts.hasDatenschutz ? "Datenschutzhinweis erkannt." : "Datenschutz: NEEDS CUSTOMER INPUT.";
    return {
      text: `${imp} ${dse} Ich erfinde keine Rechtstexte. Zweck dieser Unterhaltung: ${BOT_POLICY.purpose}. Rechtsgrundlage: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO.`,
      kind: "legal",
      evidence: "bot.legal.answered",
    };
  }
  if (/termin|buch|slot|uhrzeit|wann kann/.test(q)) {
    return {
      text: `Termine nur mit den übernommenen Unternehmensdaten. Zweckbindung: Terminverwaltung. Wählen Sie einen Slot — Name und E-Mail kommen danach, mit Einwilligung.`,
      kind: "booking",
      evidence: "bot.booking.offered",
      slots: slots(facts),
    };
  }
  if (/mail|e-mail|email|telefon|phone|adresse|anschrift|wo seid|standort/.test(q)) {
    const bits = [
      facts.emails[0] && `E-Mail: ${facts.emails[0]}`,
      facts.phones[0] && `Telefon: ${facts.phones[0]}`,
      facts.address && `Ort: ${facts.address}`,
      facts.hours && `Zeiten: ${facts.hours}`,
    ].filter(Boolean);
    return {
      text: bits.length
        ? bits.join(" · ")
        : "Kontaktdaten stehen nicht in der übernommenen Quelle. NEEDS CUSTOMER INPUT.",
      kind: bits.length ? "answer" : "refuse",
      evidence: "bot.contact.answered",
    };
  }
  if (/leistung|service|angebot|was macht|was bietet|preis/.test(q)) {
    if (/preis|kosten|gebühr|euro/.test(q)) {
      return {
        text: "Preise übernehme ich nicht, wenn sie nicht in der Quelle stehen. Ich erfinde keine Zahlen.",
        kind: "refuse",
        evidence: "bot.price.refused",
      };
    }
    if (!facts.services.length) {
      return {
        text: "Leistungen: NEEDS CUSTOMER INPUT — in der Quelle nicht gefunden.",
        kind: "refuse",
        evidence: "bot.services.missing",
      };
    }
    return {
      text: facts.services.map((s) => `${s.title}: ${s.description}`).join("\n"),
      kind: "answer",
      evidence: "bot.services.answered",
    };
  }
  if (/urlaub|ferien|geschlossen|betriebsferien/.test(q)) {
    return {
      text: facts.vacations ? `Abwesend: ${facts.vacations}. In diesem Zeitraum keine Termine.` : "Kein Urlaub hinterlegt.",
      kind: "answer",
      evidence: "bot.vacation.answered",
    };
  }
  if (/öffnungs|offen|wann habt|zeiten/.test(q)) {
    const extra = facts.vacations ? ` Urlaub: ${facts.vacations}.` : "";
    return {
      text: (facts.hours || "Öffnungszeiten: NEEDS CUSTOMER INPUT.") + extra,
      kind: facts.hours ? "answer" : "refuse",
      evidence: "bot.hours.answered",
    };
  }
  if (/wer seid|über euch|firma|unternehmen/.test(q)) {
    return {
      text: facts.description || `${facts.company} — ${facts.host}`,
      kind: "answer",
      evidence: "bot.about.answered",
    };
  }
  return {
    text: "Das steht nicht in den übernommenen Inhalten. Ich erfinde nichts. Formulieren Sie neu, fragen Sie nach Leistungen, Kontakt oder Termin — oder verlangen Sie einen Menschen.",
    kind: "refuse",
    evidence: "bot.unknown.refused",
  };
}
