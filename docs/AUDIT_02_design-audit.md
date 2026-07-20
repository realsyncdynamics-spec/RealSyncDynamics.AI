# Audit #2: Design-System & Visual Consistency

**Ausführungsdatum**: 2026-07-20  
**Analysiert**: tailwind.config.ts, src/components/ (138 Components)

---

## 🎨 Das Kern-Problem: Zwei Design-Systeme im Konflikt

```
┌─────────────────────────────────────────────┐
│ LANDING PAGES (Marketing)                   │
├─────────────────────────────────────────────┤
│ Vibe:        "European Enterprise Trust"    │
│ Farbe:       Petrol (#0F766E), Slate (hell) │
│ Rund:        border-radius: 20px (chip)     │
│ Vibe:        ✅ Vertrauen, Warm, Einladend  │
│                                             │
│ User-Experience: "Komm zu uns, wir sind seriös" │
│ Design-Richtung: Soft, Human, Approachable │
└─────────────────────────────────────────────┘

VS.

┌─────────────────────────────────────────────┐
│ APP / DASHBOARD (Product)                   │
├─────────────────────────────────────────────┤
│ Vibe:        "Hard-Edge Industrial"         │
│ Farbe:       Obsidian (#0A0A0B), Titanium   │
│ Kantig:      border-radius: 2-4px           │
│ Vibe:        ⚠️ Technisch, Kühl, Entfernt   │
│                                             │
│ User-Experience: "Das ist ein komplexes Werkzeug" │
│ Design-Richtung: Clean, Technical, Minimal │
└─────────────────────────────────────────────┘

BEIM USER:
Landing →    [✅ Ich vertrau dem]
             ↓
Click →      [Warte, wo bin ich jetzt?]
             ↓
App →        [❌ Das fühlt sich anders an]
             ↓
Cognitive Load: 📈 TOO HIGH
```

---

## 🎭 Design-System Analyse

### Farb-Palette (aus tailwind.config.ts)

#### Dark/Industrial Theme (App)
```
obsidian:        #0A0A0B (Very Dark Gray - App Background)
titanium:        #E2E2E2 (Very Light - Text & Borders)
security-blue:   #0052FF (Vivid Blue - Action CTAs)
```

#### Light/European Theme (Landing)
```
petrol:          #0F766E (Teal - Accent, Trust)
slate-50:        #F8FAFC (Almost White - Background)
slate-100:       #F1F5F9 (Light Gray)
slate-200:       #E2E8F0 (Medium Light)
... (scale bis)
slate-950:       #020617 (Almost Black)
```

### Das Problem der Farb-Konsistenz

```
App:                              Landing:
┌──────────────────────┐          ┌──────────────────────┐
│ obsidian bg          │          │ slate-50 bg          │
│ #0A0A0B              │          │ #F8FAFC              │
│                      │          │                      │
│ titanium text        │          │ slate-900 text       │
│ #E2E2E2              │          │ #0F172A              │
│                      │          │                      │
│ security-blue CTA    │          │ petrol CTA           │
│ #0052FF              │          │ #0F766E              │
└──────────────────────┘          └──────────────────────┘

KONTRAST: Sehr hoch (Weiß auf Schwarz)
USER PERCEPTION: "Seh-technisch"

KONTRAST: Mittel (Dunkel auf Hell)
USER PERCEPTION: "Lesbar, angenehm"
```

### Border-Radius Inkonsistenz

**App (Hard-Edge):**
```
xs: 2px   - Minimal rund
sm: 4px   - Knapp abgerundet
md: 6px   - Standard
lg: 8px   - Selten benutzt

Effekt:  ▯ Kantig, Technisch, Kalt
```

**Landing (Soft):**
```
chip:  20px  - Sehr rund (Pills, Buttons)
card:  10px  - Moderat rund (Cards)
panel: 12px  - Moderat rund (Panels)

Effekt: ◯ Warm, Einladend, Approachable
```

**Problem:**
- Buttons auf Landing haben 20px radius
- Buttons in App haben 4px radius
- Gleiche Farbe (blue), aber komplett anders WIRKEND

### Typography System

**Definiert (tailwind.config.ts):**
```
fontFamily:
  sans:    'Plus Jakarta Sans' (Primary)
  mono:    'JetBrains Mono' (Code)
  display: 'Plus Jakarta Sans' (Fallback: Space Grotesk)

fontSize Scale (Standard):
  xs:    12px / 16px line-height
  sm:    14px / 20px line-height
  base:  16px / 24px line-height (Standard)
  lg:    18px / 28px line-height
  xl:    20px / 28px line-height
  2xl:   24px / 32px line-height
  ...bis 6xl: 60px
```

**Gute Nachricht:** Plus Jakarta Sans überall (einheitlich)  
**Problem:** Aber wird überlagert durch komponenten-spezifische Overrides

### Spacing System

**Definiert:**
```
xs:  4px
sm:  8px
md:  12px
lg:  16px
xl:  24px
2xl: 32px
3xl: 48px
4xl: 64px
```

**Gute Nachricht:** Klar definiert  
**Problem:** Nicht überall verwendet (viele feste Pixel-Werte im Code)

### Shadow System

```
sm:           0 1px 2px 0 rgba(0, 0, 0, 0.05)       (Minimal)
md:           0 4px 6px -1px rgba(0, 0, 0, 0.1)    (Standard)
lg:           0 10px 15px -3px rgba(0, 0, 0, 0.1) (Medium)
xl:           0 20px 25px -5px rgba(0, 0, 0, 0.1) (Large)
2xl:          0 25px 50px -12px rgba(0, 0, 0, 0.25) (Huge)
glass:        0 8px 32px rgba(31, 38, 135, 0.37)  (Glassmorphism)
glow-petrol:  0 0 20px rgba(15, 118, 110, 0.3)   (Glow Effect)
glow-blue:    0 0 20px rgba(0, 82, 255, 0.3)     (Glow Effect)
```

---

## 🧩 Component Inventory

### Bestehende Components (138 Insgesamt)

#### Navigation & Layout (13)
- `Navbar` - App Top Navigation
- `LandingNavbar` - Public Site Navigation
- `PageShell` - Page Wrapper
- `Sidebar` - Left Sidebar
- `Breadcrumb` - Navigation Path
- `Container` - Max-Width Wrapper
- `Grid`, `Stack` - Layout Primitives
- `Modal`, `Drawer` - Overlays
- `Pagination` - Page Navigation
- `ErrorBoundary` - Error Handling
- `ScrollToTop` - Scroll Behavior

#### Governance Browser Shell (15)
- `GovernanceBrowserShell` - Main Container
- `BrowserTopBar` - Top Navigation
- `GovernanceTabs` - Tab Navigation (26+ Tabs)
- `GovernanceAddressBar` - URL/Breadcrumb Bar
- `GovernanceCanvas` - Content Area
- `GovernanceStatusBar` - Bottom Status
- `GovernanceChatSidebar` - Chat Sidebar
- `GovernanceAssistantPanel` - AI Panel
- `MobileBottomNavigation` - Mobile Nav
- `ModuleStatusBadge` - Status Indicator
- `ModuleUpgradeGate` - Paywall Component
- `GovernancePricingMatrix` - Feature Matrix
- `GovernanceBotsSection` - Bots Features
- `GovernanceTierGate` - Plan Gating
- `GovernanceGraphSection` - Graph Display

#### Data Display (20)
- `List`, `Table`, `Grid` - Data Containers
- `Progress`, `ProgressBar` - Progress Indicators
- `Timeline` - Timeline View
- `Stepper` - Step Navigation
- `Badge`, `Chip`, `Tag` - Labels
- `Card`, `Panel` - Content Cards
- `Alert`, `Toast`, `Notification` - Messages
- `Stat`, `Metric` - KPI Display
- `Chart`, `Graph` - Data Visualization
- `ComparisonTable` - Feature Comparison

#### Forms & Input (12)
- `Input`, `Textarea` - Text Input
- `Select`, `Dropdown` - Selection
- `Checkbox`, `Radio` - Toggle Input
- `DatePicker`, `TimePicker` - Date/Time
- `FileUpload` - File Input
- `FormGroup` - Form Wrapper
- `Label` - Form Labels
- `ErrorMessage` - Validation

#### Buttons & CTA (8)
- `Button` (Primary, Secondary, Danger, Ghost, Link)
- `IconButton` - Icon-Only Button
- `ButtonGroup` - Button Group
- `SplitButton` - Dropdown Button

#### Runtime-Spezifisch (12)
- `RuntimeCard` - Runtime Display
- `RuntimeTerminal` - Terminal UI
- `RuntimeAgentCard` - Agent Card
- `RuntimeStatusPill` - Status Display
- `RuntimeFeed` - Activity Feed
- `RuntimeEvent` - Event Display
- `RuntimeMetric` - Metric Display
- `RuntimeEvidenceCard` - Evidence Card
- `RuntimeStatusBar` - Bottom Status

#### Audit & Evidence (8)
- `AuditResultCard` - Audit Result
- `AuditSummary` - Summary Card
- `EvidenceVaultPreview` - Vault Preview
- `EvidenceCard` - Evidence Item
- `PolicyPackAutoActivator` - Auto-Policy
- `ComplianceScoreGauge` - Score Display
- `AuditCopilotPanel` - AI Assistant
- `ConfidenceScore` - Confidence Metric

#### Landing Page Sections (15)
- `HeroSection` - Hero Banner
- `LandingFaqSection` - FAQ
- `ComplianceFAQ` - Compliance FAQ
- `CompetitorComparisonSection` - Comparison
- `AiActSequenceSection` - Educational
- `AgentOversightSection` - Agent Info
- `InfrastructureIntegrationsStrip` - Integrations
- `GlobalRuntimeFeedSection` - Live Feed
- `BrowserExtensionSection` - Extension Info
- `DeploymentGovernanceSection` - Product Features
- `GovernancePricingMatrix` - Pricing
- `GovernanceBotsSection` - Bots
- `ArchitectureDiagram` - Diagram
- `IdealCustomers` - Customer Avatars
- `NewsletterForm` - Email Signup

#### Forms & Capture (8)
- `NewsletterForm` - Email Signup
- `MethodologyBooking` - Booking Form
- `WaitlistSection` - Waitlist
- `HumanVerificationGate` - Bot Check
- `FoundingAccessForm` - Founding Access
- `DiscoveryIntakeForm` - Discovery Form
- `AssistentChip` - AI Trigger
- `AssistentQuickChatModal` - Quick Chat

#### Governance-Spezifisch (12)
- `GovernanceGraphSection` - Graph Display
- `EvidenceVaultPreview` - Preview
- `PolicyPackAutoActivator` - Auto Activate
- `GovernanceTierGate` - Plan Gate
- `RuntimeCard` - Runtime Display
- `RuntimeShell` - Runtime Container
- `AuditCopilotPanel` - AI Assistant
- `ConfidenceScore` - Confidence
- `AiActSequenceSection` - AI-Act Info
- `AgentOversightSection` - Agent Info
- `ComplianceRoadmapView` - Roadmap
- `ScanProgressIndicator` - Scan Status

#### Other (15)
- `SEOHead` - SEO Meta Tags
- `ScrollToTop` - Auto Scroll
- `CookieConsent` - Cookie Banner
- `LegalDisclaimer` - Legal Notices
- `Logo` - Logo Component
- `OnboardingTour` - Product Tour
- `DemoDashboard` - Demo View
- `DemoReadOnlyWrapper` - Demo Wrapper
- `ErrorBoundary` - Error Handling
- `LoadingSpinner` - Loading
- `SkeletonLoader` - Placeholder
- `Carousel` - Image Carousel
- `Tooltip` - Help Text
- `Popover` - Popup Info
- `Search` - Search Component

---

## ⚠️ Design-Konsistenz-Probleme

### Problem 1: Button-Styles Konfusion

**Landing Pages (Buttons):**
```tsx
// Beispiel: CTA Button auf Landing
<button className="px-6 py-3 rounded-chip bg-petrol text-slate-50">
  Free Scan
</button>
→ Output: Pillenform, Teal, Warm
```

**App (Buttons):**
```tsx
// Beispiel: CTA Button in App
<button className="px-6 py-3 rounded-md bg-security-blue text-titanium">
  Save Changes
</button>
→ Output: Slightly rounded, Bright Blue, Cold
```

**User empfindet:** "Sind das nicht zwei verschiedene Apps?"

### Problem 2: Card-Designs

**Landing:**
```tsx
<div className="rounded-card bg-white/80 backdrop-blur-md shadow-lg">
  {/* Glassmorphism, rund, hell, Tiefenschluss */}
</div>
→ Output: Sanfte Cards mit Depth
```

**App:**
```tsx
<div className="rounded-md bg-obsidian border border-titanium/20">
  {/* Flach, kantig, dunkel, minimalistisch */}
</div>
→ Output: Aggressive Cards ohne Warmth
```

### Problem 3: Text-Lesbarkeit

**Landing:**
```
Dunkler Text auf hellem Hintergrund (Normal)
Kontrast: Hoch, entspannt zu lesen
```

**App:**
```
Heller Text auf dunklem Hintergrund (Inverted)
Kontrast: Extrem hoch, anstrengend zu lesen (bei längerer Nutzung)
```

---

## 📋 Fehlende Components

Basierend auf Audit sollten diese Components existieren, tun es aber nicht:

```
MISSING DESIGN SYSTEM:

1. ButtonPrimary / ButtonSecondary / ButtonTertiary
   → Es gibt einen Button, aber keine klaren Varianten

2. Card / CardSection / CardGroup
   → Es gibt Panels, aber keine strukturierte Hierarchy

3. Badge / Chip / Tag
   → Badge existiert, aber Unterschiede zu Chip unklar

4. Form / FormField / FormGroup
   → Es gibt Input, aber keine FormField-Wrapper

5. Alert / Warning / Success / Error
   → Toast/Alert existiert, aber nicht konsistent

6. Avatar / AvatarGroup
   → Keine Avatar-Components erkannt

7. Breadcrumb / Stepper
   → Breadcrumb existiert, Stepper-Nutzung unklar

8. Modal / Dialog / Drawer / Popover
   → Modal existiert, aber keine Modal-Arten (Confirm, Alert)

9. Tabs / TabGroup / TabPanel
   → GovernanceTabs existiert, aber ist sehr spezifisch

10. Sidebar / SidebarGroup / SidebarItem
    → Sidebar existiert, aber keine Items
```

---

## 🎯 Was muss getan werden (Phase 2)

### Design-System Centralization

```
Neuer Ordner: src/design-system/

src/design-system/
├─ colors/
│  ├─ brand.ts       (petrol, security-blue)
│  ├─ surface.ts     (obsidian, titanium, slate)
│  ├─ status.ts      (success, error, warning, info)
│  ├─ semantic.ts    (action, primary, secondary)
│  └─ palette.md     (Dokumentation)
│
├─ components/
│  ├─ Button/
│  │  ├─ Button.tsx
│  │  ├─ Button.stories.tsx
│  │  ├─ Button.styles.ts
│  │  └─ README.md
│  │
│  ├─ Card/
│  ├─ Badge/
│  ├─ Modal/
│  └─ ... 20+ weitere
│
├─ tokens/
│  ├─ spacing.ts
│  ├─ typography.ts
│  ├─ shadows.ts
│  ├─ colors.ts
│  └─ borders.ts
│
└─ themes/
   ├─ light.ts     (Landing-Theme)
   └─ dark.ts      (App-Theme)
```

### zwei Design-Systeme oder eins?

**Option A: Zwei Systeme (Current - Bad)**
- Landing ist "warm, einladend"
- App ist "technisch, minimal"
- → User sieht zwei Apps

**Option B: Eins System mit Varianten (Recommended)**
- Farben: Petrol-basiert (einheitlich)
- Spacing: Konsistent
- Typography: Konsistent
- Border-Radius: Konsistent aber modal-spezifisch
  - Landing: 20px (pill-shapes, trust-focused)
  - App: 8-12px (balanced, professional)

---

## ✅ Audit-Abschluss

**Erkannt:**
- 138 Components (aber nicht zentral dokumentiert)
- Zwei Design-Systeme im Konflikt
- Tailwind sehr gut konfiguriert (aber nicht überall genutzt)
- Plus Jakarta Sans überall (Gutes Zeichen!)

**Probleme:**
1. **Design-Bruch** zwischen Landing und App (Farbschema, Radius, Gefühl)
2. **Fehlende Component-Library** (keine Storybook, keine Katalog)
3. **Keine Dokumentation** (Welcher Button-Style ist wann?)
4. **Spacing-Inkonsistenzen** (Nicht überall `spacing.md` genutzt)
5. **Dark Mode Problem** — App ist sehr dunkel, schwer länger zu benutzen

**Nächster Schritt:** Audit #3 (Feature-Status Matrix & Hidden Features)
