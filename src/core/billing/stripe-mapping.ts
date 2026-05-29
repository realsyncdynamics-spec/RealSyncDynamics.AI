export const STRIPE_PLAN_MAPPING: Record<string, { priceId: string; label: string }> = {
  free_audit: {
    priceId: 'price_1TVbcMCNKcHrCAICoX7QYcxA',
    label: 'Frei (Audit-Modus)',
  },
  starter: {
    priceId: 'price_1TVbdCCNKcHrCAICUiJEMfyf',
    label: 'Anlasser (Starter)',
  },
  growth: {
    priceId: 'price_1TVbdbCNKcHrCAICBr5X3NmN',
    label: 'Wachstum (Growth)',
  },
  agency: {
    priceId: 'price_1TVbduCNKcHrCAICT0IYHOmB',
    label: 'Unternehmen (Agency)',
  }
};

export function getStripePriceId(planKey: string): string {
  const mapping = STRIPE_PLAN_MAPPING[planKey];
  if (!mapping) {
    throw new Error(`[Billing Error] Unbekannter oder nicht autorisierter Plan-Key: ${planKey}`);
  }
  return mapping.priceId;
}
