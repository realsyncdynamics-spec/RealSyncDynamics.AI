import { PlanKey } from './types';

export const PRICE_TO_PLAN: Record<string, PlanKey> = {
  'price_free_internal': 'free',
  'price_bronze_monthly': 'bronze',
  'price_bronze_yearly': 'bronze',
  'price_silver_monthly': 'silver',
  'price_silver_yearly': 'silver',
  'price_gold_monthly': 'gold',
  'price_gold_yearly': 'gold',
  'price_enterprise_manual': 'enterprise_public',
};

export const ADD_ON_KEYS = {
  extraSeat: 'addon.extra_seat',
  extraApiPack: 'addon.api_pack',
  extraBulkPack: 'addon.bulk_pack',
  compliancePack: 'addon.compliance_pack',
} as const;
