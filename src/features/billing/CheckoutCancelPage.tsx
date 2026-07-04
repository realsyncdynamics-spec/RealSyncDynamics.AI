/**
 * Checkout Cancel Page — shown if user cancels checkout
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

export function CheckoutCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4 py-16">
      <div className="bg-obsidian-800 border border-titanium-700 rounded p-8 max-w-md text-center">
        <div className="inline-block mb-4 text-4xl">❌</div>
        <h1 className="text-2xl font-bold text-titanium-50 mb-2">Checkout abgebrochen</h1>
        <p className="text-titanium-300 mb-8">
          Du hast den Checkout-Prozess beendet. Deine Zahlung wurde nicht verarbeitet.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full px-6 py-3 bg-security-500 text-white font-bold uppercase hover:bg-security-600"
          >
            Zurück zur Plan-Auswahl
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-obsidian-700 text-titanium-50 border border-titanium-600 font-bold uppercase hover:bg-obsidian-600"
          >
            Zur Startseite
          </button>
        </div>

        <p className="text-sm text-titanium-400 mt-6">
          Noch Fragen?{' '}
          <a href="mailto:support@realsyncdynamicsai.de" className="text-titanium-300 hover:text-titanium-100">
            Schreib uns
          </a>
        </p>
      </div>
    </div>
  );
}
