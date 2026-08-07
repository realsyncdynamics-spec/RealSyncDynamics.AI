# Entitlements Matrix – RealSyncDynamics.AI

**Version:** 1.0  
**Datum:** 2026-08-07  
**Status:** Final – Basierend auf strategischer Ausrichtung  
**Zweck:** Klare Definition der Feature-Berechtigungen pro Plan, um Pricing technisch durchzusetzen

---

## 🎯 Strategische Positionierung

| Plan | Preis | Rolle | Geschäftsmodell |
|------|-------|-------|------------------|
| **Free** | 0 € | Einstieg / Entwickler / Evaluation | Lead Generation |
| **Starter** | 79 € | Kleine Teams | Subscription (ARR) |
| **Growth** | 249 € | **Kern-SaaS** | Subscription (ARR) |
| **Agency** | 699 € | Multi-Tenant / Dienstleister | Subscription (ARR) |
| **Enterprise** | 1.249 € | **Große Organisationen (strategisch)** | Subscription (ARR) |
| **Partner** | 1.999 € | Reseller / White Label | **Anderes Geschäftsmodell** (Provision) |

**Wichtig:**
- **Enterprise** = Firma nutzt RealSyncDynamics.AI **selbst**
- **Partner** = Agentur verkauft RealSyncDynamics.AI an **eigene Kunden**
- **Agent-OS** ist **kein separater Tarif**, sondern die **Execution Runtime** von RealSyncDynamics.AI

---

## 📊 Entitlements Matrix

### 🔹 **Core Platform Features**

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multi-Language UI** (DE/EN) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tenant Isolation** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ❌ | ❌ | Optional | ✅ |
| **White-Label Dashboard** | ❌ | ❌ | ❌ | ❌ | Optional | ✅ |
| **Dedicated Subdomain** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### 🔹 **AI Governance Layer**

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **AI Risk Assessment** | Basic | ✅ | ✅ | ✅ | Advanced | Advanced |
| **Policy Engine** | ❌ | ✅ (DSGVO, EU AI Act) | ✅ (DSGVO, EU AI Act, ISO 27001) | ✅ (Alle) | ✅ (Alle + Custom) | ✅ (Alle + Custom) |
| **Risk Register** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Compliance Reports** | ❌ | ✅ (PDF) | ✅ (PDF/JSON) | ✅ (Signiert) | ✅ (Signiert + Audit) | ✅ (Signiert + Audit) |
| **Governance Score** | ✅ (Basic) | ✅ | ✅ (Pro Rahmenwerk) | ✅ (Pro Rahmenwerk) | ✅ (Konsolidiert) | ✅ (Konsolidiert) |
| **Drift Detection** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Remediation Plans** | ❌ | ✅ (5) | ✅ (20) | ✅ (100) | ✅ (500) | ✅ (Unlimited) |

---

### 🔹 **Evidence & Audit Layer**

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Audit Logs** | Basic | ✅ | ✅ | ✅ | Immutable | Immutable |
| **Evidence Vault** | ❌ | Basic (2 GB) | ✅ (10 GB) | ✅ (50 GB) | Advanced (200 GB) | Advanced (500 GB) |
| **Hash-Chain Verification** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Legal Hold** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Retention Policies** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Audit Export** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Signed Evidence (C2PA)** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

### 🔹 **Agent Runtime & Automation** *(Agent-OS Features – inklusive in allen Plänen ab Growth)*

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Agent Workflows** | ❌ | Basic (1 Bot) | ✅ (2 Bots) | ✅ (10 Bots) | Unlimited | Unlimited |
| **OpenClaw Gateway** | ❌ | ❌ | ✅ (1 Gateway) | ✅ (5 Gateways) | Unlimited | Unlimited |
| **Automation Engine** | ❌ | ✅ (25 Runs/Monat) | ✅ (100 Runs/Monat) | ✅ (500 Runs/Monat) | ✅ (2.000 Runs/Monat) | ✅ (10.000 Runs/Monat) |
| **Scheduler** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Bulk Jobs** | ❌ | ❌ | ❌ | ✅ (100/Monat) | ✅ (500/Monat) | Unlimited |
| **Background Jobs** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Drift Detection** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

### 🔹 **Multi-Tenant & Reseller** *(Nur für Agency, Enterprise, Partner)*

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Multi-Tenant** | ❌ | ❌ | ❌ | ✅ (1 Tenant) | ✅ (5 Tenants) | ✅ (50 Tenants) |
| **Tenant Isolation** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Central User Management** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SSO (SAML/OIDC)** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SCIM Provisioning** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **White-Label Reports** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **White-Label Dashboard** | ❌ | ❌ | ❌ | ❌ | Optional | ✅ |
| **Custom Domain** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### 🔹 **Channels & Communication**

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Website Chat** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **WhatsApp** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Telegram** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Slack** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Teams** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Email** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Voice** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **API Access** | ❌ | Basic | ✅ | ✅ | Full | Full |
| **Webhooks** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

### 🔹 **Support & SLA**

| Feature | Free | Starter | Growth | Agency | Enterprise | Partner |
|---------|------|---------|--------|--------|-----------|---------|
| **Support Level** | Community | Email | Priority | Priority | Dedicated | Dedicated |
| **Response Time** | Best Effort | 24h | 4h | 4h | **4h (SLA)** | **4h (SLA)** |
| **Dedicated Account Manager** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Onboarding Call** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Training Sessions** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

### 🔹 **Limits Overview** *(Zusammenfassung der technischen Limits)*

| Limit | Free | Starter | Growth | Agency | Enterprise | Partner |
|-------|------|---------|--------|--------|-----------|---------|
| **Domains** | 1 | 1 | 3 | 10 | 25 | 100 |
| **Bots** | 0 | 1 | 2 | 10 | 20 | 50 |
| **Answers/Monat** | 0 | 500 | 2.000 | 25.000 | 50.000 | 100.000 |
| **Automation Runs/Monat** | 0 | 25 | 100 | 500 | 2.000 | 10.000 |
| **Seats** | 1 | 1 | 5 | 15 | 50 | 100 |
| **API Calls/Monat** | 0 | 0 | 0 | 50.000 | 250.000 | 1.000.000 |
| **Evidence Storage (GB)** | 0.5 | 2 | 10 | 50 | 200 | 500 |
| **Audit Reports/Monat** | 1 | 2 | 12 | 50 | 200 | 500 |
| **Tenants** | 1 | 1 | 1 | 1 | 5 | 50 |

---

## 🔧 Technische Durchsetzung

### **1. Feature Gates (Backend)**
Jedes Feature muss im Backend geprüft werden:
```typescript
// Beispiel: Evidence Vault Zugriff
if (!plan.permissions.evidenceVault) {
  throw new Error('Evidence Vault nicht in Ihrem Plan enthalten');
}
```

### **2. Limits Enforcement (Backend)**
Technische Limits müssen erzwungen werden:
```typescript
// Beispiel: API Calls pro Monat
if (currentApiCalls >= plan.limits.apiCallsPerMonth) {
  throw new Error('API-Limit erreicht');
}
```

### **3. Frontend UI (Conditional Rendering)**
Features nur anzeigen, wenn berechtigt:
```tsx
{plan.permissions.sso && <SSOSettings />}
{plan.limits.tenants > 1 && <MultiTenantDashboard />}
```

---

## 📋 Product Area Mapping

### **🔹 GOVERN (Compliance & Rahmenwerke)**
| Modul | Free | Starter | Growth | Agency | Enterprise | Partner |
|-------|------|---------|--------|--------|-----------|---------|
| DSGVO | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| EU AI Act | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ISO 27001 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| NIS2 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| TISAX | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| DORA | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Policy Engine | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Evidence Vault | ❌ | Basic | ✅ | ✅ | Advanced | Advanced |
| Audit Center | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Risk Register | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monitoring | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compliance Reports | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### **🔹 AUTOMATE (Automation & Workflows)**
| Modul | Free | Starter | Growth | Agency | Enterprise | Partner |
|-------|------|---------|--------|--------|-----------|---------|
| Scheduler | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Workflows | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| n8n | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Kodee | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bulk Jobs | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Automation Engine | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alerts | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Drift Detection | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Remediation | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Background Jobs | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

### **🔹 ENGAGE (Kanäle & Interaktion)**
| Modul | Free | Starter | Growth | Agency | Enterprise | Partner |
|-------|------|---------|--------|--------|-----------|---------|
| AI Bots | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voice | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| WhatsApp | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Telegram | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Website Chat | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| API | ❌ | Basic | ✅ | ✅ | Full | Full |
| Webhooks | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Human Handoff | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Multi Channel Messaging | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 💡 Usage-Based Pricing (Vorbereitung für Phase 3)

### **Metriken für zukünftiges Usage-Based Pricing:**

| Metrik | Einheit | Messung | Abrechnung |
|--------|--------|---------|------------|
| **Agent Tasks** | Aufgaben | Pro Ausführung | 0,10 €/Task |
| **Evidence Storage** | GB | Pro GB/Monat | 0,50 €/GB |
| **API Events** | Aufrufe | Pro 1.000 Aufrufe | 0,05 €/1.000 |
| **AI Provider Costs** | Tokens | Pro 1.000 Tokens | Durchreichung + 10% |
| **Compute Time** | Minuten | Pro Minute | 0,02 €/Min |

### **Inklusive Kontingente (Enterprise Beispiel):**
- **10.000 Agent Tasks** (inklusive)
- **100 GB Evidence Storage** (inklusive)
- **50.000 API Events** (inklusive)
- **Darüber hinaus:** Usage-Based Abrechnung

---

## 📌 Wichtige Hinweise

### ✅ **Bestätigte Strategie:**
1. **Pricing bleibt unverändert** (79 €, 249 €, 699 €, 1.249 €, 1.999 €)
2. **Partner-Plan wird beibehalten** (anderes Geschäftsmodell: Reseller)
3. **Agent-OS ist kein separater Tarif**, sondern Teil von RealSyncDynamics.AI
4. **Fokus auf ARR durch Subscription** (Usage-Based Pricing später)

### 🔧 **Nächste technische Schritte (Phase 2):**
1. **Stripe Products/Prices prüfen** (müssen mit `shared/pricing.ts` übereinstimmen)
2. **Feature Gates implementieren** (Backend-Prüfung der Berechtigungen)
3. **Tenant Limits technisch erzwingen** (z. B. `tenants <= plan.limits.tenants`)

### 🛡️ **Enterprise Security Layer (Phase 3):**
- SSO (SAML/OIDC)
- SCIM Provisioning
- Audit Export (signiert)
- Signierte Evidence (C2PA)
- SLA (4h Reaktionszeit)

---

## 📄 Referenzen
- [Pricing Architecture](PRICING_ARCHITECTURE.md)
- [shared/pricing.ts](../../shared/pricing.ts) (Single Source of Truth)
- [Stripe Pricing Seed](stripe-pricing-seed.template.sql)

---

**Dokument-Informationen:**
- **Erstellt von:** Vibe Code (Mistral AI)
- **Basierend auf:** Strategischer Ausrichtung (2026-08-07)
- **Letzte Aktualisierung:** 2026-08-07
- **Version:** 1.0
