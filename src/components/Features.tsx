import { motion } from 'motion/react';
import { LayoutDashboard, ShieldCheck, Store, ArrowLeftRight, Server, Globe } from 'lucide-react';

const features = [
  {
    name: 'RealSync Creator OS',
    description: 'Das zentrale Betriebssystem für Ihre digitalen Assets. Verwalten Sie Content, Rechte und Workflows an einem Ort.',
    icon: LayoutDashboard,
    color: 'bg-security-400',
  },
  {
    name: 'RealSync Copilot (Extension)',
    description: 'Ihre Sider.ai-Alternative: Ein zentrales Multi-Model Gateway (GPT-5, Claude, Gemini) direkt als Browser-Sidebar.',
    icon: Globe,
    color: 'bg-indigo-500',
  },
  {
    name: 'RealSync CreatorSeal',
    description: 'Digitale Echtheitszertifikate nach C2PA-Standard. Schützen Sie Ihre Werke vor KI-Manipulation und Diebstahl.',
    icon: ShieldCheck,
    color: 'bg-emerald-500',
  },
  {
    name: 'RealSync Market',
    description: 'Der sichere Marktplatz für verifizierte digitale Assets. Handeln Sie Lizenzen transparent und nachvollziehbar.',
    icon: Store,
    color: 'bg-violet-500',
  },
  {
    name: 'RealSync DealFlow & LocalFlow',
    description: 'Automatisierte Verträge und On-Premise Datenverarbeitung für höchste Enterprise Sicherheitsanforderungen.',
    icon: Server,
    color: 'bg-titanium-800',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-obsidian-900 border-t border-titanium-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold tracking-tight text-titanium-50 sm:text-4xl">
            Ein modulares Ökosystem
          </h2>
          <p className="mt-4 text-lg text-titanium-400 font-light">
            Wählen Sie genau die Module, die Sie für Ihre digitale Wertschöpfungskette benötigen. Nahtlos integriert und hochsicher.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`group relative p-8 rounded-none border border-titanium-900 transition-all duration-300 overflow-hidden ${
                index === 1 || index === 4 ? 'bg-obsidian-950 text-white shadow-xl' : 'bg-obsidian-950 hover:bg-obsidian-900 hover:shadow-xl hover:shadow-slate-200/50 text-titanium-50'
              } ${index === 3 || index === 4 ? 'lg:col-span-1.5' : ''}`}
            >
              {/* Optional ambient glow for dark cards */}
              {(index === 1 || index === 4) && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-white/0 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
              )}
              
              <div className={`w-12 h-12 rounded-none flex items-center justify-center mb-6 shadow-sm border ${
                index === 1 || index === 4 ? 'bg-obsidian-800 border-titanium-800' : 'bg-obsidian-900 border-titanium-900 text-titanium-200'
              }`}>
                <feature.icon className={`h-6 w-6 ${index === 1 || index === 4 ? 'text-white' : 'text-security-400'}`} />
              </div>
              
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">
                {feature.name}
              </h3>
              <p className={`leading-relaxed text-sm ${index === 1 || index === 4 ? 'text-titanium-600' : 'text-titanium-300'}`}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
