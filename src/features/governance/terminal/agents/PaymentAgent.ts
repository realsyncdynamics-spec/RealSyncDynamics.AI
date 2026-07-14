import { TerminalMessage } from '../useAgenticTerminal';

export interface StripeCheckoutConfig {
  tier: 'starter' | 'growth' | 'agency' | 'scale';
  monthlyPrice: number;
  currency: string;
  features: string[];
}

const TIER_CONFIGS: Record<string, StripeCheckoutConfig> = {
  starter: {
    tier: 'starter',
    monthlyPrice: 49,
    currency: 'EUR',
    features: ['10 scans/month', 'Basic audit reports', 'Email support'],
  },
  growth: {
    tier: 'growth',
    monthlyPrice: 249,
    currency: 'EUR',
    features: ['50 scans/month', 'AI classification', 'Custom frameworks', 'Webhook access'],
  },
  agency: {
    tier: 'agency',
    monthlyPrice: 999,
    currency: 'EUR',
    features: ['Unlimited scans', 'Full AI governance', 'Team collaboration', 'Dedicated support'],
  },
  scale: {
    tier: 'scale',
    monthlyPrice: 2999,
    currency: 'EUR',
    features: ['Enterprise features', 'Custom SLA', 'Priority support', 'Compliance certifications'],
  },
};

export interface PaymentIntent {
  checkoutUrl: string;
  sessionId: string;
  expiresAt: Date;
  tier: string;
}

export interface InvoiceRequest {
  tier: string;
  email: string;
  billingAddress: string;
  invoiceId: string;
  dueDate: Date;
}

function generateSessionId(): string {
  return `cs_${crypto.randomUUID().slice(0, 8)}`;
}

function generateInvoiceId(): string {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const seq = Math.floor(Math.random() * 10000);
  return `INV-${yearMonth}-${String(seq).padStart(5, '0')}`;
}

export function createCheckoutSession(tier: string): PaymentIntent {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  return {
    checkoutUrl: `https://checkout.realsync.ai/${tier}-${Date.now()}`,
    sessionId: generateSessionId(),
    expiresAt,
    tier,
  };
}

export function createInvoiceRequest(tier: string, email: string, billingAddress: string): InvoiceRequest {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  return {
    tier,
    email,
    billingAddress,
    invoiceId: generateInvoiceId(),
    dueDate,
  };
}

export function formatUpgradeMessage(tier: string, checkoutUrl: string): TerminalMessage[] {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    return [];
  }

  const messages: TerminalMessage[] = [];

  // Loading message
  const loadMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `💳 Loading ${config.tier.toUpperCase()} package (€${config.monthlyPrice}/mo)`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(loadMsg);

  // Features message
  const featuresMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `Features: ${config.features.join(', ')}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(featuresMsg);

  // Checkout link message
  const linkMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `✓ Checkout link: ${checkoutUrl}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(linkMsg);

  // Agent box
  const agentBox = `
┌─ PAYMENT AGENT ────────────────────┐
│ Click the link to complete payment. │
│ Or type /pay ${tier} for invoice.     │
│ Your 14-day trial starts now.       │
└────────────────────────────────────┘`;

  const agentMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: agentBox,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(agentMsg);

  return messages;
}

export function formatInvoiceMessage(invoice: InvoiceRequest): TerminalMessage[] {
  const config = TIER_CONFIGS[invoice.tier];
  if (!config) {
    return [];
  }

  const messages: TerminalMessage[] = [];

  // Invoice sending message
  const sendMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `📨 Sending invoice to ${invoice.email}`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(sendMsg);

  // Invoice details
  const detailsMsg: TerminalMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    content: `Invoice#: ${invoice.invoiceId}
Amount: €${config.monthlyPrice}.00 (first month)
Due: ${invoice.dueDate.toLocaleDateString()}
IBAN transfer details included in email`,
    timestamp: new Date(),
    type: 'info',
  };
  messages.push(detailsMsg);

  return messages;
}

export function formatPaymentAgentBox(): string {
  return `┌─ PAYMENT AGENT ────────────────────┐
│ Invoice sent to your email address. │
│ Reply to /upgrade after payment.    │
└────────────────────────────────────┘`;
}
