/**
 * DemoTourSignupPage — Fake-Signup-Form für die Demo-Tour
 *
 * Sammelt Demo-Daten (E-Mail, Unternehmen, Name) aber erstellt
 * keinen echten Account. Weiterleitung zu Demo-Checkout.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useDemoTour } from '../core/demo/DemoTourContext';

export function DemoTourSignupPage() {
  const navigate = useNavigate();
  const { setTourStep, setDemoUserData } = useDemoTour();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setDemoUserData(formData.email, formData.company, formData.name);
    setTourStep('checkout');

    await new Promise((resolve) => setTimeout(resolve, 800));
    navigate('/demo-tour/checkout');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-4">
        <button
          onClick={() => navigate('/demo-tour')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-petrol-700 text-white flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <span className="text-sm font-medium text-slate-600">Daten</span>

            <div className="flex-1 h-px bg-slate-300 mx-2" />

            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <span className="text-sm font-medium text-slate-500">Checkout</span>

            <div className="flex-1 h-px bg-slate-300 mx-2" />

            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <span className="text-sm font-medium text-slate-500">Dashboard</span>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Demo-Tour starten
            </h1>
            <p className="text-slate-600 text-sm mb-6">
              Geben Sie Ihre Daten ein, um die Governance OS zu erkunden (keine Registrierung nötig)
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ihr Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="z.B. Max Mustermann"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="ihre@email.de"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-500 focus:border-transparent"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unternehmen / Organisation
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  placeholder="z.B. Acme GmbH"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-500 focus:border-transparent"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 py-2.5 bg-petrol-700 hover:bg-petrol-800 disabled:bg-petrol-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Laden…
                  </>
                ) : (
                  <>
                    Weiter zum Checkout <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Info */}
            <p className="text-xs text-slate-500 mt-4 text-center">
              💡 Dies ist eine Demo-Tour. Keine echte Registrierung oder Zahlung erforderlich.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
