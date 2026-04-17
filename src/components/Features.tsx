import { motion } from 'motion/react';
import { LayoutDashboard, ShieldCheck, Store, ArrowLeftRight, Server, Globe } from 'lucide-react';

const features = [
  {
    name: 'RealSync Creator OS',
    description: 'Das zentrale Betriebssystem für Ihre digitalen Assets. Verwalten Sie Content, Rechte und Workflows an einem Ort.',
    icon: LayoutDashboard,
    color: 'bg-blue-500',
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
    color: 'bg-slate-700',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-white border-t border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Ein modulares Ökosystem
          </h2>
          <p className="mt-4 text-lg text-slate-500 font-light">
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
              className={`group relative p-8 rounded-3xl border border-slate-200/60 transition-all duration-300 overflow-hidden ${
                index === 1 || index === 4 ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 text-slate-900'
              } ${index === 3 || index === 4 ? 'lg:col-span-1.5' : ''}`}
            >
              {/* Optional ambient glow for dark cards */}
              {(index === 1 || index === 4) && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-white/0 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
              )}
              
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-sm border ${
                index === 1 || index === 4 ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <feature.icon className={`h-6 w-6 ${index === 1 || index === 4 ? 'text-white' : 'text-blue-600'}`} />
              </div>
              
              <h3 className="font-display text-xl font-bold tracking-tight mb-3">
                {feature.name}
              </h3>
              <p className={`leading-relaxed text-sm ${index === 1 || index === 4 ? 'text-slate-300' : 'text-slate-600'}`}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
