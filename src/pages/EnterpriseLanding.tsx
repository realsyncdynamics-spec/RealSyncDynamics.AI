import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Zap, Lock, BarChart3, Users, Briefcase, CheckCircle2,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /enterprise — Enterprise-Landing mit Case Studies & Testimonials.
 *
 * Zielgruppe: große Organisationen, DSBs, Compliance-Teams.
 * Value Prop: Continuous Governance Runtime, Audit Evidence, Enterprise SLA.
 *
 * Design: Obsidian/Titanium/Gold/Petrol, Hard-Edge, monospace metadata.
 */

export function EnterpriseLanding() {
  usePageMeta({
    title: 'Enterprise Governance Platform — RealSyncDynamics.AI',
    description: 'Continuous Compliance Runtime für Großunternehmen. Evidence Vault, Multi-Tenant, 4h SLA, Audit-Ready.',
    url: 'https://realsyncdynamicsai.de/enterprise',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-4">
              Enterprise Governance
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.1] mb-6">
              Continuous Governance für Großunternehmen
            </h1>
            <p className="text-lg sm:text-xl text-silver-300 leading-relaxed max-w-3xl mx-auto mb-8">
              Evidence Vault mit Audit Trail, Runtime Monitoring, Multi-Tenant Management, 4h Support SLA.
              EU-gehostet. DSGVO + EU AI Act konform.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/contact-sales?intent=enterprise"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              Enterprise anfragen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
            >
              Pricing ansehen
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-6 text-center text-sm">
            {[
              { label: 'Unternehmen', value: '150+' },
              { label: 'Domains', value: '50k+' },
              { label: 'Uptime SLA', value: '99.9%' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display font-bold text-3xl sm:text-4xl text-gold-400 mb-1">
                  {stat.value}
                </div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points → Solutions */}
      <section className="border-t border-titanium-900 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Enterprise Challenges
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight">
              Die Probleme großer Organisationen
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: BarChart3,
                challenge: 'Audit Burden',
                solution: 'Automated Evidence Vault mit Timestamped Audit Trail. Alle Scans, Findings, Fixes dokumentiert und exportierbar.',
                color: 'text-gold-400',
              },
              {
                icon: Zap,
                challenge: 'Regulatory Drift',
                solution: 'Daily Runtime Monitoring. Neue Risiken werden erkannt, bevor sie zu Bußgeldern führen. Alert im Dashboard.',
                color: 'text-gold-400',
              },
              {
                icon: Users,
                challenge: 'Knowledge Silos',
                solution: 'Centralized Governance Platform. Team-Collaboration, Templating, Approvals. Multi-Tenant, vollständig isoliert.',
                color: 'text-gold-400',
              },
              {
                icon: Lock,
                challenge: 'Compliance Complexity',
                solution: 'Integrated Checklists für DSGVO, EU AI Act, BAIT, MaRisk. Auto-generates Dokumentation für Behörden.',
                color: 'text-gold-400',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.challenge} className="p-6 border border-titanium-800 hover:border-gold-400/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <Icon className={`h-5 w-5 ${item.color} shrink-0 mt-1`} />
                    <div>
                      <h3 className="font-display font-bold text-titanium-50 text-lg mb-2">
                        {item.challenge}
                      </h3>
                      <p className="text-sm text-silver-300 leading-relaxed">
                        {item.solution}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Case Studies
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight">
              Wer nutzt RealSync Dynamics Enterprise
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                company: 'Fintech SaaS — KI-Kreditvergabe',
                industry: 'Finanzdienstleistungen',
                challenge: 'KI-Entscheidungen müssen unter EU AI Act Nachweise liefern. 50 tägliche AI Inferences.',
                solution: 'RealSync Evidence Vault trackt jede KI-Decision. Zeitstempel + Input + Output. Bei Beschwerde: Beweis vorlegbar.',
                impact: '3 Behörden-Audits, 0 Beanstandungen',
                testimonial: 'RealSync erspart uns Months an Dokumentationarbeit. Die Evidence Vault ist rechtsicher.',
                author: 'Compliance Officer, Fintech SaaS',
                quote: true,
              },
              {
                company: 'DSB-Kanzlei — Datenschutzberatung',
                industry: 'Rechtswesen / Beratung',
                challenge: '200+ Mandanten, Monitoring für alle, Audit-Ready Reports gefordert.',
                solution: 'Multi-Tenant Plattform. Jeder Mandant sieht nur seine Daten. API für automatisierte Kundenreports.',
                impact: '200+ Mandanten betreut, 95% Automation',
                testimonial: 'Wir können jetzt Monitoring als Service anbieten — RealSync macht es wirtschaftlich.',
                author: 'Geschäftsführer, DSB-Kanzlei',
                quote: true,
              },
              {
                company: 'Versicherungsgruppe — MaRisk Compliance',
                industry: 'Finanzdienstleistungen',
                challenge: 'MaRisk § 4 Abs. 3 — jährlich Audit-Trails für Behörden erforderlich. Manuelle Prozesse fehlerbehaftet.',
                solution: 'Automated Evidence Export. Daily Snapshots, archiviert, nicht manipulierbar. Reports als PDF/CSV.',
                impact: '0 Audit-Findings in 2 Jahren, 40h/Jahr Zeiteinsparung',
                testimonial: 'Die automatisierte Evidence Collection ist Lifesaver. Compliance ist nicht mehr ein Stress-Punkt.',
                author: 'Head of Compliance, Versicherungsgruppe',
                quote: true,
              },
              {
                company: 'Mittelständische SaaS — Growth Phase',
                industry: 'B2B SaaS',
                challenge: 'Enterprise-Kunden fragen: "Ist DSGVO eingebaut?" Manuelle Nachweise nicht skalierbar.',
                solution: 'RealSync als Compliance-Verkaufsargument. "Wir nutzen Enterprise-Grade Governance."',
                impact: '+3 Enterprise-Deals, +€500k ARR',
                testimonial: 'Governance ist nicht länger ein Blocker. Es ist jetzt ein Sales-Argument.',
                author: 'VP Sales, B2B SaaS',
                quote: true,
              },
            ].map((caseStudy) => (
              <div
                key={caseStudy.company}
                className="p-6 border border-titanium-800 hover:border-gold-400/50 transition-colors"
              >
                <div className="mb-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gold-400 mb-1">
                    {caseStudy.industry}
                  </div>
                  <h3 className="font-display font-bold text-titanium-50 text-lg mb-4">
                    {caseStudy.company}
                  </h3>
                </div>

                <div className="space-y-3 mb-5 text-sm text-silver-300">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 mb-1">
                      Challenge
                    </div>
                    <p>{caseStudy.challenge}</p>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 mb-1">
                      Lösung
                    </div>
                    <p>{caseStudy.solution}</p>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-gold-400 mb-1">
                      Impact
                    </div>
                    <p className="font-semibold text-titanium-50">{caseStudy.impact}</p>
                  </div>
                </div>

                {caseStudy.quote && (
                  <div className="pt-5 border-t border-titanium-800">
                    <p className="text-sm text-silver-300 italic mb-2">
                      "{caseStudy.testimonial}"
                    </p>
                    <p className="text-xs text-titanium-400 font-mono">
                      — {caseStudy.author}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="border-t border-titanium-900 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Enterprise Features
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight">
              Was ist im Enterprise-Plan enthalten
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'Evidence Vault (unveränderlich, mit Audit Trail)',
              'Multi-Tenant Management (unlimited Kunden)',
              'White-Label (Logo, Domains, Branding)',
              'REST API + Webhooks',
              'Priority Support (4h SLA)',
              'Custom Training + Onboarding',
              'Compliance Certifications (ISO, SOC2, etc.)',
              'Unlimited Users + API Keys',
              'Custom Dashboards & Reports',
              'AI Model Selection (Claude, GPT, Gemma)',
              'Volume Discounts (25%+)',
              'Dedicated Account Manager',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3 p-4 border border-titanium-800 rounded-none">
                <CheckCircle2 className="h-4 w-4 text-gold-400 shrink-0 mt-1" />
                <span className="text-sm text-silver-200">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Pricing */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Pricing
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight mb-6">
            Custom Enterprise Plans
          </h2>
          <p className="text-lg text-silver-300 leading-relaxed mb-10">
            Abhängig von Anzahl der Domains, Benutzer, API-Calls, und SLA-Anforderungen.
            <br />
            <strong>Start ab €1.500/Monat</strong> · Volume Discounts verfügbar.
          </p>

          <Link
            to="/contact-sales?intent=enterprise"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Angebot anfordern <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-10 p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none text-sm text-silver-300">
            <p>
              <strong className="text-titanium-50">Flexible Terms:</strong> Jährliche oder monatliche Abrechnung.
              <br />
              <strong className="text-titanium-50">Customization:</strong> Wir passen Features, Integrations und Workflows an.
              <br />
              <strong className="text-titanium-50">Garantie:</strong> 30 Tage Risk-Free Trial mit Daten-Zugang.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-titanium-900 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight mb-6">
            Bereit für Enterprise-Grade Governance?
          </h2>
          <p className="text-lg text-silver-300 mb-8 leading-relaxed">
            Termin vereinbaren, Fragen stellen, oder Technical Deep-Dive mit unserem Team.
          </p>
          <Link
            to="/contact-sales?intent=enterprise"
            className="surface-gold inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-none"
          >
            Termin vereinbaren <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default EnterpriseLanding;
