import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { CheckCircle, ArrowRight, Shield, Zap, FileText, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function AuditLanding() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <>
      <SEOHead
        title="EU AI Act Compliance Check — Instant Website Audit"
        description="Scan your website in 2 minutes. Get an instant compliance score for DSGVO, HTTPS, AI Disclosure, and Privacy Policy."
      />

      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link to="/" className="font-semibold text-lg text-slate-900">
              RealSync
            </Link>
            <div className="flex gap-4 items-center">
              <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition">
                Pricing
              </Link>
              <Link to="/welcome" className="text-sm px-4 py-2 rounded-chip bg-petrol-700 text-white hover:bg-petrol-800 transition">
                Sign In
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6">
              EU AI Act Compliance Check
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Scan your website and get an instant compliance score. Know your risks in 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/scan" className="px-8 py-4 bg-petrol-700 text-white text-lg font-semibold rounded-chip hover:bg-petrol-800 transition flex items-center gap-2 justify-center">
                Try Free <ArrowRight size={20} />
              </Link>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 border-2 border-slate-300 text-slate-900 text-lg font-semibold rounded-chip hover:border-slate-400 transition">
                Learn More
              </button>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-4xl font-bold text-slate-900 mb-6">Compliance Risk is Real</h2>
                <p className="text-lg text-slate-600 mb-6">
                  80% of websites unknowingly violate EU AI Act Article 52. Without transparent disclosure when AI is used to interact with users, your website faces legal risk.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="text-petrol-700 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <p className="font-semibold text-slate-900">DSGVO Compliance</p>
                      <p className="text-slate-600 text-sm">Cookie banners, privacy policies, consent tracking</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="text-petrol-700 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <p className="font-semibold text-slate-900">AI Disclosure</p>
                      <p className="text-slate-600 text-sm">Article 52: transparent labeling of AI services</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="text-petrol-700 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <p className="font-semibold text-slate-900">Technical Security</p>
                      <p className="text-slate-600 text-sm">HTTPS, TLS certificates, secure infrastructure</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-card p-8 h-64 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-6xl font-bold text-petrol-700 mb-2">80%</p>
                  <p className="text-lg text-slate-600">of websites lack proper AI disclosure</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-petrol-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl font-bold text-petrol-700">1</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Enter Your URL</h3>
                <p className="text-slate-600">Paste your website URL or domain. No account needed yet.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-petrol-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap size={32} className="text-petrol-700" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Instant Scan</h3>
                <p className="text-slate-600">Our AI analyzes DSGVO, HTTPS, AI Disclosure, Privacy Policy in seconds.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-petrol-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText size={32} className="text-petrol-700" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Download Report</h3>
                <p className="text-slate-600">Get an audit-grade PDF with findings, severity levels, and remediation tips.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">Simple, Transparent Pricing</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="border-2 border-slate-200 rounded-card p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Free Audit</h3>
                <p className="text-4xl font-bold text-slate-900 mb-1">€0</p>
                <p className="text-slate-600 mb-6">einmalig · kein Account</p>
                <Link to="/scan" className="w-full px-6 py-3 bg-slate-200 text-slate-900 font-semibold rounded-chip hover:bg-slate-300 transition text-center block mb-8">
                  Try Free
                </Link>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">URL scan with compliance score</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Top findings highlighted</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Download PDF report</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">No credit card required</span>
                  </li>
                </ul>
              </div>
              <div className="border-4 border-petrol-700 rounded-card p-8 bg-gradient-to-br from-petrol-50 to-white relative">
                <div className="absolute -top-4 left-6 bg-petrol-700 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2 mt-4">Professional</h3>
                <p className="text-4xl font-bold text-slate-900 mb-1">€79</p>
                <p className="text-slate-600 mb-6">/ Monat (mit 14 Tagen kostenlos)</p>
                <Link to="/checkout/starter?pilot=true" className="w-full px-6 py-3 bg-petrol-700 text-white font-semibold rounded-chip hover:bg-petrol-800 transition text-center block mb-8">
                  14 Days Free
                </Link>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Everything in Free</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Weekly rescans (drift detection)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Email alerts for new findings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Compliance evidence archive</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-petrol-700 flex-shrink-0" />
                    <span className="text-slate-600">Priority support</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-center text-slate-600 text-sm mt-12">
              Free audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: "What is the EU AI Act?", a: "The EU AI Act regulates AI use in Europe. Article 52 requires transparency when AI systems interact with users — disclose chatbots, AI-generated content, and similar services." },
                { q: "Is my scan private?", a: "Yes. We don't store emails or share results. Scan data is encrypted and only visible to you. Free audits leave no trace unless you create an account." },
                { q: "How long does a scan take?", a: "Typically 30-60 seconds. Your website is fetched, analyzed, and a report is generated. No manual review needed." },
                { q: "What if my site fails?", a: "We provide actionable remediation steps. For example, if AI disclosure is missing, we tell you exactly what text to add and where." },
                { q: "Do I need a subscription?", a: "No. Try the free audit first. Upgrade only if you want continuous monitoring and weekly rescans." }
              ].map((faq, idx) => (
                <div key={idx} className="border border-slate-200 rounded-card overflow-hidden">
                  <button onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition text-left">
                    <span className="font-semibold text-slate-900">{faq.q}</span>
                    <ChevronDown size={20} className={`text-slate-600 transition-transform ${expandedFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedFaq === idx && (
                    <div className="px-6 py-4 bg-slate-50 text-slate-600 border-t border-slate-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-petrol-700 to-petrol-800 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Check Your Compliance?</h2>
            <p className="text-xl mb-8 text-petrol-100">Get your audit-grade report in 2 minutes. No credit card required.</p>
            <Link to="/scan" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-petrol-700 font-semibold rounded-chip hover:bg-slate-100 transition text-lg">
              Start Free Audit <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <p className="font-semibold text-white mb-4">RealSync</p>
                <p className="text-sm">EU-sovereign AI compliance for modern websites.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-4">Product</p>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/audit" className="hover:text-white transition">Audit Tool</Link></li>
                  <li><Link to="/pricing" className="hover:text-white transition">Pricing</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-4">Legal</p>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link></li>
                  <li><Link to="/terms-of-service" className="hover:text-white transition">Terms of Service</Link></li>
                  <li><Link to="/impressum" className="hover:text-white transition">Impressum</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-4">Support</p>
                <ul className="space-y-2 text-sm">
                  <li><a href="mailto:support@realsync.app" className="hover:text-white transition">support@realsync.app</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-8 text-sm text-center">
              <p>&copy; 2026 RealSync Dynamics AI UG. Made in Germany.</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
