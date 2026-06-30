import React from 'react';
import { CheckoutPage } from '../../features/billing/CheckoutPage';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';

/**
 * Enterprise-OS Checkout Wrapper
 * Verbindet alte CheckoutPage (/features/billing) mit Enterprise-OS Design
 * (PublicNav, PublicFooter, Obsidian/Titanium Container)
 */
export function CheckoutPageWrapper() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />
      <div className="border-b border-titanium-800">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <CheckoutPage />
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
