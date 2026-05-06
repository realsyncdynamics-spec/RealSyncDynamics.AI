import { useState } from 'react';
import { Link } from 'react-router-dom';

interface FormState {
  name: string;
  email: string;
  company: string;
  phone: string;
  employees: string;
  message: string;
}

const initialForm: FormState = { name: '', email: '', company: '', phone: '', employees: '', message: '' };

export function ContactSales() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="sticky top-0 z-50 border-b border-titanium-900 bg-obsidian-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-titanium-100">
            RealSync<span className="text-security-400">Dynamics</span>.AI
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-titanium-300 md:flex">
            <Link to="/agencies" className="hover:text-titanium-100">Agenturen</Link>
            <Link to="/pricing" className="hover:text-titanium-100">Preise</Link>
            <Link to="/dashboard" className="hover:text-titanium-100">Login</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">Demo-Anfrage</p>
        <h1 className="mb-4 text-4xl font-bold text-titanium-100">Sprechen Sie mit unserem Vertrieb</h1>
        <p className="mb-12 text-titanium-400">Unser Team meldet sich innerhalb eines Werktags bei Ihnen.</p>

        {submitted ? (
          <div className="border border-security-500 bg-obsidian-900 p-10 text-center">
            <h2 className="mb-4 text-2xl font-bold text-security-400">Vielen Dank!</h2>
            <p className="text-titanium-300">Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden.</p>
            <Link to="/" className="mt-8 inline-block bg-security-500 px-6 py-3 text-obsidian-950 font-semibold hover:bg-security-400">Zur Startseite</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="name">Vollstandiger Name *</label>
              <input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 placeholder-titanium-600 focus:border-security-500 focus:outline-none"
                placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="email">Geschaftliche E-Mail *</label>
              <input id="email" name="email" type="email" required value={form.email} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 placeholder-titanium-600 focus:border-security-500 focus:outline-none"
                placeholder="max@unternehmen.de" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="company">Unternehmen *</label>
              <input id="company" name="company" type="text" required value={form.company} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 placeholder-titanium-600 focus:border-security-500 focus:outline-none"
                placeholder="Mustermann GmbH" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="phone">Telefonnummer</label>
              <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 placeholder-titanium-600 focus:border-security-500 focus:outline-none"
                placeholder="+49 30 123456" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="employees">Anzahl Mitarbeiter</label>
              <select id="employees" name="employees" value={form.employees} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 focus:border-security-500 focus:outline-none">
                <option value="">Bitte auswahlen</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-1000">201-1.000</option>
                <option value="1000+">1.000+</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-titanium-300" htmlFor="message">Ihre Nachricht</label>
              <textarea id="message" name="message" rows={5} value={form.message} onChange={handleChange}
                className="w-full border border-titanium-900 bg-obsidian-900 px-4 py-3 text-titanium-100 placeholder-titanium-600 focus:border-security-500 focus:outline-none resize-none"
                placeholder="Beschreiben Sie kurz Ihre Anforderungen..." />
            </div>
            <button type="submit" className="bg-security-500 py-4 text-obsidian-950 font-bold text-lg hover:bg-security-400">Demo anfragen</button>
            <p className="text-xs text-titanium-600 text-center">
              Mit dem Absenden stimmen Sie unserer{' '}
              <Link to="/legal/privacy" className="underline hover:text-titanium-300">Datenschutzerklarung</Link> zu.
            </p>
          </form>
        )}
      </main>

      <footer className="border-t border-titanium-900 py-10">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <span className="text-sm text-titanium-500">2025 RealSyncDynamics.AI</span>
          <div className="flex gap-6 text-sm text-titanium-500">
            <Link to="/legal/privacy" className="hover:text-titanium-100">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-100">Sub-Prozessoren</Link>
            <Link to="/contact-sales" className="hover:text-titanium-100">Kontakt</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
