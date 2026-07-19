export type RiskLevel = 'low' | 'medium' | 'high';
export type AccountType = 'business' | 'personal';

export interface MarketingMetric {
  period_start: string;
  period_end: string;
  cac: number;
  ltv: number;
  cmrr: number;
  conversion_rate: number;
}

export interface ShadowSeoTool {
  id: string;
  tool_name: string;
  tool_category: string;
  active_users: number;
  risk_level: RiskLevel;
  sso_enabled: boolean;
  account_type: AccountType;
  data_exposure_risk: boolean;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface CustomerSummary {
  active_customers: number;
  churned_customers: number;
  new_customers: number;
}

export interface DashboardData {
  marketing_metrics: MarketingMetric[];
  shadow_seo_tools: ShadowSeoTool[];
  security_events: SecurityEvent[];
  customer_summary: CustomerSummary;
}

export interface PeriodMetrics {
  cac: number;
  ltv: number;
  ltv_cac_ratio: number;
  conversion_rate: number;
  churn_rate: number;
  cmrr: number;
}

export interface Metrics extends PeriodMetrics {
  period_metrics: PeriodMetrics;
}

export interface TrendDataPoint {
  date: string;
  cac: number;
  ltv: number;
  cmrr: number;
}
