import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  ShieldCheck,
  Radar,
  FileLock2,
  Scale,
  Lock,
  ServerCog,
  GitBranch,
  Code2,
  Check,
  Zap,
  BookOpen,
} from 'lucide-react';

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Continuous Risk Monitoring',
    text: 'Real-time assessment of AI systems against EU AI Act risk classifications. Detect compliance gaps as they emerge.',
  },
  {
    icon: FileLock2,
    title: 'Immutable Audit Trail',
    text: 'Cryptographic evidence for every decision, model deployment, and data transformation. Proof for auditors and regulators.',
  },
  {
    icon: Scale,
    title: 'EU AI Act Enforcement',
    text: 'Automated classification of AI systems by risk level. Policy enforcement at runtime, not retrospectively.',
  },
  {
    icon: Lock,
    title: 'DSGVO Data Governance',
    text: 'Automated data subject rights (Art. 15, 17), lifecycle tracking, and compliance holds for regulated data.',
  },
  {
    icon: ServerCog,
    title: 'Policy-as-Code',
    text: 'Deploy DSGVO, EU AI Act, and industry-specific governance policies. Enforce at runtime across multi-tenant infrastructure.',
  },
  {
    icon: Code2,
    title: 'Provenance & Lineage',
    text: 'C2PA-signed decision provenance. Track model, data, and decision lineage for explainability and accountability.',
  },
];

const MARKETS = [
  { title: 'Financial Services', desc: 'Model risk management, consumer protection, anti-discrimination audits' },
  { title: 'Healthcare', desc: 'Medical device classification, patient safety, clinical evidence trails' },
  { title: 'Insurance', desc: 'Underwriting fairness, actuarial model governance, claims transparency' },
  { title: 'Public Sector', desc: 'Administrative transparency, citizen rights, accountability to regulators' },
  { title: 'HR & Recruiting', desc: 'Hiring bias detection, fairness audits, candidate privacy' },
  { title: 'Industry 4.0', desc: 'Autonomous systems safety, supply chain control, regulatory certification' },
];

export function GovernanceRuntimeLayerPage() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead title="Governance Runtime Layer for Enterprise AI | RealSync Dynamics" description="Control plane for safe, compliant, auditable AI operations — not another deployment tool." />
      <Header />
      <Hero />
      <Thesis />
      <Capabilities />
      <Markets />
      <Differentiation />
      <Roadmap />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-sm sm:text-lg font-semibold">RealSync Dynamics.AI</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className="text-sm text-white/70 hover:text-white">Back to Home</Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-28 pb-16">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-transparent" />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-10 text-center">
        <p className="font-mono text-xs sm:text-sm tracking-[0.25em] text-cyan-400/90 mb-6 uppercase">Governance Runtime Layer</p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6">
          Control Plane for Enterprise AI
        </h1>
        <p className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
          Others help you deploy AI faster. We help you operate AI safely, transparently, and compliant with regulation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/flow/start-scan?source=governance-runtime" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
            Free Governance Assessment <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/contact-sales?source=governance-runtime" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
            Enterprise Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

function Thesis() {
  return (
    <Section eyebrow="What's Different" title="The Positioning Shift" subtitle="">
      <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/[0.05]">
          <h3 className="font-mono text-sm text-red-400 font-bold mb-3">Traditional Approach</h3>
          <p className="text-white/70 leading-relaxed">
            "Our platform helps you roll out AI faster and easier."
          </p>
          <p className="text-xs text-white/50 mt-4">Result: Speed gains, but governance risk and audit complexity grow.</p>
        </div>
        <div className="p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05]">
          <h3 className="font-mono text-sm text-cyan-400 font-bold mb-3">RealSync Approach</h3>
          <p className="text-white/70 leading-relaxed">
            "Our platform ensures you can run AI at enterprise scale — auditable, compliant, and governance-native."
          </p>
          <p className="text-xs text-white/50 mt-4">Result: Speed + compliance + regulatory evidence built-in.</p>
        </div>
      </div>

      <div className="mt-12 max-w-3xl mx-auto p-8 border border-cyan-500/30 bg-cyan-500/[0.08] rounded-xl">
        <h3 className="text-xl font-bold mb-4">Core Thesis</h3>
        <p className="text-white/80 leading-relaxed">
          Instead of bolting governance onto existing AI systems post-hoc, RealSync integrates compliance into the fabric of AI operations. Governance is not an afterthought or a separate tool — it is the foundation of the platform.
        </p>
      </div>
    </Section>
  );
}

function Capabilities() {
  return (
    <Section eyebrow="Platform Capabilities" title="Governance at Runtime" subtitle="Six core pillars that replace manual audit processes with automated, continuous, auditeable operations.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {CAPABILITIES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group p-6 sm:p-8 bg-[rgb(3,7,18)] hover:bg-white/[0.03] transition-colors">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-5">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Markets() {
  return (
    <Section eyebrow="Market Fit" title="For Industries Where Governance is Non-Negotiable" subtitle="If your business depends on regulatory compliance and customer trust, RealSync is built for you.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MARKETS.map(({ title, desc }) => (
          <div key={title} className="p-6 sm:p-8 border border-white/10 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Differentiation() {
  return (
    <Section eyebrow="Why RealSync" title="Competitive Advantages" subtitle="">
      <div className="space-y-4 max-w-2xl">
        {[
          { label: 'EU-Sovereign', desc: 'Data residency, sovereign stack, no US cloud lock-in' },
          { label: 'Governance-First', desc: 'Not bolted on; core to the architecture and product roadmap' },
          { label: 'Multi-Tenant RLS', desc: 'Enterprise isolation by default; single customer data leak impossible' },
          { label: 'Policy-as-Code', desc: 'Deploy DSGVO, EU AI Act, and industry-specific governance packs' },
          { label: 'Immutable Evidence', desc: 'Hash-chain-verified, retention-enforced audit logs for auditors' },
          { label: 'C2PA Provenance', desc: 'Ed25519-signed decision lineage for external verification' },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-4 p-5 border border-white/10 rounded-lg bg-white/[0.02]">
            <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <h4 className="font-semibold mb-1">{label}</h4>
              <p className="text-sm text-white/60">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Roadmap() {
  return (
    <Section eyebrow="Timeline" title="Phase 2 → Phase 3 Roadmap" subtitle="">
      <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        <div className="p-6 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.08]">
          <p className="font-mono text-xs tracking-widest text-cyan-400 uppercase mb-2">Phase 2 (Now)</p>
          <h3 className="text-lg font-semibold mb-4">Production-Ready</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              Audit Module (DSGVO Scan, Recheck-Cron)
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              Policy Packs & Auto-Mapping
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              Evidence Vault (Hash-Verified)
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              Governance Runtime (Sentinel Loops)
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              C2PA Provenance (Ed25519)
            </li>
          </ul>
          <p className="text-xs text-white/50 mt-4">Go-live: 2026-08-01</p>
        </div>
        <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
          <p className="font-mono text-xs tracking-widest text-white/50 uppercase mb-2">Phase 3 (2027)</p>
          <h3 className="text-lg font-semibold mb-4">Market Expansion</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
              Initial customer traction (Finance, Healthcare)
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
              TypeScript strict migration
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
              Social Orchestrator (Governance as a Service)
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
              Advanced Dashboard & Reporting
            </li>
          </ul>
          <p className="text-xs text-white/50 mt-4">Target: Series A funding</p>
        </div>
      </div>
    </Section>
  );
}

function CTA() {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-10">
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-8 sm:p-12 md:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4">
            Start Building Governance Infrastructure
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto mb-8 leading-relaxed">
            Get a baseline assessment of your AI governance posture in 5 minutes — free scan, no sales call, no account required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/flow/start-scan?source=governance-page-cta" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
              Start Free Assessment <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact-sales?source=governance-page-cta" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
              <BookOpen className="w-4 h-4" />Schedule Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mb-10 md:mb-12">
          <p className="font-mono text-xs tracking-[0.25em] text-cyan-400/90 mb-3 uppercase">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">{title}</h2>
          {subtitle && <p className="text-base text-white/60 leading-relaxed">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-xs text-white/50">© 2026 RealSync Dynamics. Governance Runtime Infrastructure.</p>
          <div className="flex gap-6">
            <Link to="/" className="text-sm text-white/60 hover:text-white transition-colors">Home</Link>
            <Link to="/contact-sales" className="text-sm text-white/60 hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
