import { Check, MessageCircle, Zap, MessageSquare, Globe } from 'lucide-react';
import { PUBLIC_PRICING_TIERS, BOT_ADDONS, botAddonsByTier } from '../../config/pricing';

/**
 * Governance-Bots Section — zeigt Bot-Quotas pro Tier + Add-on-Karten
 *
 * Positioniert sich nach dem Hauptpricingsektor, vor FAQ.
 * Erklärt: Bots sind nicht separates Produkt, sondern integriertes Modul
 * der RealSync-Governance-Runtime mit Compliance-Features (AI Act, DSGVO, Logging).
 */

export function GovernanceBotsSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5 text-security-500" />
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100">
              Governance-Bots
            </span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-4">
            KI-Bots mit Compliance-Rahmen
          </h2>
          <p className="text-base text-silver-300 leading-relaxed max-w-3xl">
            Governance-Bots sind kein separates Chatbot-Produkt. Sie sind ein integriertes Modul der RealSync-Runtime mit
            transparenter KI-Kennzeichnung, Antwortprotokoll, Risiko-Tags, Kanal-Logging und Evidence-Erfassung.
            <strong> Jede KI-Kommunikation bleibt nachvollziehbar: Wer fragte, was antwortete der Bot, welcher Kanal,
            welche Compliance-Regeln waren aktiv?</strong>
          </p>
        </div>

        {/* Bot-Quotas pro Tier */}
        <div className="mb-16">
          <h3 className="font-display font-bold text-xl text-titanium-50 mb-8">
            Bot-Kontingent pro Paket
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {PUBLIC_PRICING_TIERS.filter((t) => t.id !== 'free').map((tier) => {
              const quota = tier.botsQuota;
              const isUnlimited = quota.maxBots === -1;

              return (
                <div
                  key={tier.id}
                  className="p-6 bg-obsidian-900/80 border border-silver-700/40 rounded-none"
                >
                  <div className="text-sm font-bold text-titanium-50 mb-4">{tier.name}</div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-security-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-titanium-100 font-mono">
                          {isUnlimited ? 'Unbegrenzt' : quota.maxBots} Bots
                        </div>
                        <div className="text-[11px] text-silver-400">produktiv / Monat</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-ai-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-titanium-100 font-mono">
                          {isUnlimited ? 'Unbegrenzt' : quota.maxAnswersPerMonth.toLocaleString()} Antworten
                        </div>
                        <div className="text-[11px] text-silver-400">pro Monat</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-petrol-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-titanium-100 text-[12px]">
                          {quota.channels.length > 0
                            ? quota.channels.map((c) => {
                                const names: Record<string, string> = {
                                  website: 'Website',
                                  whatsapp: 'WhatsApp',
                                  telegram: 'Telegram',
                                  slack: 'Slack',
                                  teams: 'Teams',
                                  email: 'E-Mail',
                                  voice: 'Voice'
                                };
                                return names[c] || c;
                              }).join(', ')
                            : '—'}
                        </div>
                        <div className="text-[11px] text-silver-400">verfügbare Kanäle</div>
                      </div>
                    </div>
                  </div>

                  {quota.capabilities.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-silver-700/30">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-3">
                        Fähigkeiten
                      </div>
                      <ul className="space-y-2">
                        {quota.capabilities.slice(0, 4).map((cap) => (
                          <li key={cap} className="flex items-start gap-2 text-[12px] text-silver-300">
                            <Check className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                            {cap}
                          </li>
                        ))}
                        {quota.capabilities.length > 4 && (
                          <li className="text-[11px] text-silver-500 italic">
                            + {quota.capabilities.length - 4} weitere...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Compliance-Features Highlight */}
        <div className="mb-16 p-8 bg-obsidian-950 border border-security-500/30 rounded-none">
          <h3 className="font-display font-bold text-lg text-titanium-50 mb-6">
            Compliance by Default
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'AI-Act Transparenz',
                desc: 'Automatischer Transparenzhinweis „Sie sprechen mit einem KI-Bot". Konfigurierbar pro Bot & Kanal.',
              },
              {
                title: 'Antwort-Logging',
                desc: 'Jede Frage + Antwort wird geloggt mit Timestamp, Kanal, User-Hash. DSGVO-konform und exportierbar.',
              },
              {
                title: 'Risiko-Tags',
                desc: 'Bots kennzeichnen Antworten automatisch mit Risiko-Stufe (grün/gelb/rot) je nach Intent & Kontext.',
              },
              {
                title: 'Evidence-Export',
                desc: 'PDF/CSV-Export aller Interaktionen für Audit, Datenschutzbehörden oder interne Compliance-Prüfungen.',
              },
              {
                title: 'Human Handoff',
                desc: 'Bot kann Anfragen automatisch an Mensch eskalieren bei komplexen / sensiblen Fragen.',
              },
              {
                title: 'Kanal-Isolation',
                desc: 'Separate Usage-Quotas pro Kanal, sodass z.B. WhatsApp-Traffic Website-Traffic nicht beeinflusst.',
              },
            ].map((feature, i) => (
              <div key={i} className="flex gap-3">
                <Check className="h-5 w-5 text-security-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-titanium-100 text-sm mb-1">{feature.title}</div>
                  <div className="text-[13px] text-silver-400 leading-relaxed">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add-on Karten */}
        {BOT_ADDONS.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-xl text-titanium-50 mb-8">
              Bot Add-ons (zusätzlich buchbar)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {BOT_ADDONS.map((addon) => (
                <div
                  key={addon.id}
                  className="p-6 bg-obsidian-900/80 border border-silver-700/40 rounded-none flex flex-col"
                >
                  <div className="mb-4">
                    <div className="font-bold text-titanium-50 text-base mb-1">{addon.name}</div>
                    <p className="text-[12px] text-silver-400">{addon.description}</p>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1 text-[13px]">
                    {addon.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-silver-300">
                        <Check className="h-3 w-3 text-titanium-100 flex-shrink-0 mt-0.5" />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className="pt-4 border-t border-silver-700/30">
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <div className="font-display font-bold text-xl text-titanium-100 tabular-nums">
                        {addon.priceEur} €
                      </div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400">
                        {addon.priceSuffix}
                      </div>
                    </div>
                    <div className="text-[10px] text-silver-500 italic">
                      Für Growth/Agency/Scale/Enterprise
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
