import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const tiers = [
  {
    name: 'Bronze',
    price: '0',
    description: 'Perfekt für den Einstieg in die digitale Verifizierung.',
    features: [
      'RealSync Creator OS (Basic)',
      'Bis zu 50 Assets verwalten',
      'Standard C2PA Zertifizierung',
      'Community Support',
    ],
    cta: 'Kostenlos starten',
    highlighted: false,
  },
  {
    name: 'Silver',
    price: '29',
    description: 'Für professionelle Creator und kleine Teams.',
    features: [
      'Alles aus Bronze',
      'Unbegrenzte Assets',
      'RealSync CreatorSeal (Pro)',
      'RealSync Market Zugang',
      'Email & Chat Support',
    ],
    cta: 'Silver wählen',
    highlighted: false,
  },
  {
    name: 'Gold',
    price: '99',
    description: 'Umfassende Automatisierung für Agenturen.',
    features: [
      'Alles aus Silver',
      'RealSync DealFlow Integration',
      'Automatisierte Verträge',
      'API Zugang',
      'Priority Support (24/7)',
    ],
    cta: 'Gold wählen',
    highlighted: true,
  },
  {
    name: 'Platinum',
    price: 'Custom',
    description: 'Maßgeschneiderte Lösungen für Enterprises.',
    features: [
      'Alles aus Gold',
      'RealSync LocalFlow (On-Premise)',
      'Custom Branding (White-Label)',
      'Dedizierter Account Manager',
      'SLA Garantien',
    ],
    cta: 'Vertrieb kontaktieren',
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-obsidian-900 border-t border-titanium-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold tracking-tight text-titanium-50 sm:text-4xl">
            Flexibles Freemium-Modell
          </h2>
          <p className="mt-4 text-lg text-titanium-400 font-light">
            Skalieren Sie Ihre Sicherheit mit Ihrem Erfolg. Keine versteckten Kosten, jederzeit kündbar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative flex flex-col p-8 rounded-none ${
                tier.highlighted 
                  ? 'bg-obsidian-950 text-white shadow-2xl scale-105 z-10 border border-titanium-900' 
                  : 'bg-obsidian-950 text-titanium-50 border border-titanium-900 hover:bg-obsidian-900 hover:shadow-xl hover:shadow-slate-200/50 transition-all'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-security-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    Am beliebtesten
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className={`font-display text-xl font-bold tracking-tight ${tier.highlighted ? 'text-white' : 'text-titanium-50'}`}>
                  {tier.name}
                </h3>
                <p className={`mt-2 text-sm ${tier.highlighted ? 'text-titanium-500' : 'text-titanium-400'}`}>
                  {tier.description}
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline font-display text-5xl font-extrabold tracking-tighter">
                  {tier.price !== 'Custom' && <span className="text-3xl mr-1">€</span>}
                  {tier.price}
                  {tier.price !== 'Custom' && <span className={`ml-1 text-sm font-medium tracking-normal ${tier.highlighted ? 'text-titanium-500' : 'text-titanium-400'}`}>/Monat</span>}
                </div>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 shrink-0 ${tier.highlighted ? 'text-security-300' : 'text-security-400'}`} />
                    <span className={`text-sm ${tier.highlighted ? 'text-titanium-600' : 'text-titanium-300'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/pricing"
                className={`block text-center w-full py-3 px-6 rounded-none text-sm font-semibold transition-all ${
                  tier.highlighted
                    ? 'bg-security-500 hover:bg-security-400 text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.4)]'
                    : 'bg-obsidian-900 hover:bg-obsidian-800 text-titanium-50 border border-titanium-900 shadow-sm'
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
