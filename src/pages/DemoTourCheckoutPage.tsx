/**
 * DemoTourCheckoutPage — Mock-Stripe-Checkout für Demo-Tour
 *
 * Zeigt einen realistischen Checkout-Flow (ähnlich echtem Stripe),
 * verarbeitet aber keine echte Zahlung.
 * Weiterleitung zu Demo-Dashboard nach "Zahlung".
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useDemoTour } from '../core/demo/DemoTourContext';

export function DemoTourCheckoutPage() {
  const navigate = useNavigate();
  const { tourState, setTourStep } = useDemoTour();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardData, setCardData] = useState({
    cardNumber: '4242 4242 4242 4242',
    expiryDate: '12/25',
    cvc: '123',
  });

  const handlePayment = async () => {
    setIsProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    setTourStep('dashboard');
    navigate('/demo-tour/dashboard');
  };

  const plans = [
    {
      name: 'Growth Plan',
      price: '99',
      description: 'Perfekt für kleine bis mittlere Unternehmen',
      features: [
        'Bis zu 10 AI-Systeme',
        'Automatische Compliance-Checks',
        'Governance-Score & Reports',
        'Email-Support',
        'Monatliche Updates',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-4">
        <button
          onClick={() => navigate('/demo-tour/signup')}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-petrol-700 text-white flex items-center justify-center text-sm font-semibold">
              <Check className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-slate-600">Daten</span>

            <div className="flex-1 h-px bg-petrol-700 mx-2" />

            <div className="w-8 h-8 rounded-full bg-petrol-700 text-white flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <span className="text-sm font-medium text-slate-600">Checkout</span>

            <div className="flex-1 h-px bg-slate-300 mx-2" />

            <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <span className="text-sm font-medium text-slate-500">Dashboard</span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Plan Summary */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-6">
                <h3 className="font-bold text-slate-900 mb-2">{plans[0].name}</h3>
                <p className="text-sm text-slate-600 mb-4">{plans[0].description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">
                    €{plans[0].price}
                  </span>
                  <span className="text-slate-600 text-sm">/Monat</span>
                </div>

                <div className="space-y-2 mb-6 pb-6 border-b border-slate-200">
                  {plans[0].features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-petrol-700 mt-0.5 shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Plan</span>
                    <span className="font-medium text-slate-900">€{plans[0].price}/mo</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-semibold text-slate-900">Insgesamt</span>
                    <span className="font-bold text-slate-900">€{plans[0].price}/mo</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  14 Tage kostenlos testen. Kein Risiko, jederzeit kündbar.
                </p>
              </div>
            </div>

            {/* Checkout Form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900 mb-6">Zahlung</h1>

                {/* User Info */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <strong>{tourState.demoUserName}</strong>
                    <br />
                    {tourState.demoEmail}
                    <br />
                    {tourState.demoCompany}
                  </p>
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Zahlungsart
                  </label>
                  <div className="flex gap-4">
                    {['card', 'sepa'].map((method) => (
                      <label
                        key={method}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          disabled={isProcessing}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">
                          {method === 'card' ? 'Kreditkarte' : 'SEPA Lastschrift'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Card Fields */}
                {paymentMethod === 'card' && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Kartennummer
                      </label>
                      <input
                        type="text"
                        value={cardData.cardNumber}
                        disabled
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-mono text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Demo-Modus: Zahlung wird nicht verarbeitet
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Ablauf
                        </label>
                        <input
                          type="text"
                          value={cardData.expiryDate}
                          disabled
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          CVE
                        </label>
                        <input
                          type="text"
                          value={cardData.cvc}
                          disabled
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Demo-Modus:</strong> Dies ist eine interaktive Demo.
                    Es wird keine echte Zahlung verarbeitet oder ein Account erstellt.
                  </p>
                </div>

                {/* Submit */}
                <button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full py-3 bg-petrol-700 hover:bg-petrol-800 disabled:bg-petrol-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Zahlung wird verarbeitet…
                    </>
                  ) : (
                    <>
                      €{plans[0].price}/Monat zahlen <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 mt-4 text-center">
                  Sichere Verbindung • Ihre Daten sind geschützt
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
