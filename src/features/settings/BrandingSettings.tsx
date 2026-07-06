import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Palette, Loader2, CheckCircle2, AlertTriangle, Save,
  RefreshCw, Copy, Check, Eye,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

interface BrandingData {
  company_name: string | null;
  brand_colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  } | null;
  custom_logo_url: string | null;
  favicon_url: string | null;
  support_email: string | null;
  support_phone: string | null;
  support_url: string | null;
  footer_text: string | null;
  custom_css: Record<string, unknown> | null;
}

interface BrandingPreset {
  id: string;
  name: string;
  description: string | null;
  brand_colors: Record<string, string>;
}

const DEFAULT_COLORS = {
  primary: '#0F766E',
  secondary: '#64748B',
  accent: '#0052FF',
  background: '#F8FAFC',
  text: '#0F172A',
};

export function BrandingSettings() {
  return (
    <AuthGate>
      {(session) => <Inner session={session} />}
    </AuthGate>
  );
}

function Inner({ session }: { session: Session }) {
  const { activeTenantId } = useTenant();
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeTenantId) return;
      try {
        setLoading(true);
        const { data: brandingData, error: brandingErr } = await getSupabase()
          .from('tenants')
          .select(
            'company_name, brand_colors, custom_logo_url, favicon_url, support_email, support_phone, support_url, footer_text, custom_css'
          )
          .eq('id', activeTenantId)
          .single();

        if (brandingErr) throw brandingErr;
        if (!cancelled) {
          setBranding(brandingData as BrandingData);
        }

        const { data: presetsData, error: presetsErr } = await getSupabase()
          .from('branding_presets')
          .select('id, name, description, brand_colors')
          .eq('is_public', true);

        if (presetsErr) throw presetsErr;
        if (!cancelled) {
          setPresets((presetsData || []) as BrandingPreset[]);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeTenantId]);

  async function save() {
    if (!activeTenantId || !branding) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateErr } = await getSupabase().functions.invoke('tenant-branding-update', {
        body: {
          company_name: branding.company_name,
          brand_colors: branding.brand_colors,
          custom_logo_url: branding.custom_logo_url,
          favicon_url: branding.favicon_url,
          support_email: branding.support_email,
          support_phone: branding.support_phone,
          support_url: branding.support_url,
          footer_text: branding.footer_text,
        },
      });

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function applyPreset(preset: BrandingPreset) {
    if (!branding) return;
    setBranding({
      ...branding,
      brand_colors: preset.brand_colors as BrandingData['brand_colors'],
    });
  }

  function resetToDefaults() {
    if (!branding) return;
    setBranding({
      ...branding,
      brand_colors: DEFAULT_COLORS,
    });
  }

  if (!branding) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100">
        <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
          <Link to="/settings" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-petrol-600 to-petrol-800 flex items-center justify-center">
              <Palette className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">White-Label Branding</div>
              <div className="text-[11px] text-titanium-400 font-medium">Farben · Logo · Footer</div>
            </div>
          </div>
        </header>
        <main className="flex items-center justify-center h-screen">
          <div className="flex items-center gap-2 text-titanium-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        </main>
      </div>
    );
  }

  const colors = branding.brand_colors || DEFAULT_COLORS;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/settings" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-petrol-600 to-petrol-800 flex items-center justify-center">
            <Palette className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">White-Label Branding</div>
            <div className="text-[11px] text-titanium-400 font-medium">Farben · Logo · Footer</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Company Name */}
        <Section title="Company Name" icon={<Palette className="h-4 w-4" />}>
          <div className="space-y-2">
            <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Company Name</label>
            <input
              type="text"
              value={branding.company_name || ''}
              onChange={(e) => setBranding({ ...branding, company_name: e.target.value || null })}
              placeholder="Your Company Name"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
            />
          </div>
        </Section>

        {/* Brand Colors */}
        <Section title="Brand Colors">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorField
                label="Primary"
                value={colors.primary || DEFAULT_COLORS.primary}
                onChange={(v) => setBranding({
                  ...branding,
                  brand_colors: { ...colors, primary: v },
                })}
              />
              <ColorField
                label="Secondary"
                value={colors.secondary || DEFAULT_COLORS.secondary}
                onChange={(v) => setBranding({
                  ...branding,
                  brand_colors: { ...colors, secondary: v },
                })}
              />
              <ColorField
                label="Accent"
                value={colors.accent || DEFAULT_COLORS.accent}
                onChange={(v) => setBranding({
                  ...branding,
                  brand_colors: { ...colors, accent: v },
                })}
              />
              <ColorField
                label="Background"
                value={colors.background || DEFAULT_COLORS.background}
                onChange={(v) => setBranding({
                  ...branding,
                  brand_colors: { ...colors, background: v },
                })}
              />
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-2 px-3 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-sm text-titanium-300 rounded-none"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset to Defaults
              </button>
            </div>
          </div>
        </Section>

        {/* Brand Presets */}
        {presets.length > 0 && (
          <Section title="Quick Presets">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="p-4 bg-obsidian-950 border border-titanium-900 hover:border-security-500 rounded-none text-left transition-colors"
                >
                  <div className="font-semibold text-titanium-50 text-sm mb-2">{preset.name}</div>
                  {preset.description && (
                    <p className="text-xs text-titanium-400 mb-3">{preset.description}</p>
                  )}
                  <div className="flex gap-2">
                    {Object.entries(preset.brand_colors).slice(0, 5).map(([_, color]) => (
                      <div
                        key={color}
                        className="w-6 h-6 rounded-none border border-titanium-700"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Assets & Support */}
        <Section title="Assets & Support Info">
          <div className="space-y-3">
            <Field
              label="Custom Logo URL"
              value={branding.custom_logo_url || ''}
              onChange={(v) => setBranding({ ...branding, custom_logo_url: v || null })}
              placeholder="https://example.com/logo.png"
            />
            <Field
              label="Favicon URL"
              value={branding.favicon_url || ''}
              onChange={(v) => setBranding({ ...branding, favicon_url: v || null })}
              placeholder="https://example.com/favicon.ico"
            />
            <Field
              label="Support Email"
              value={branding.support_email || ''}
              onChange={(v) => setBranding({ ...branding, support_email: v || null })}
              placeholder="support@example.com"
              type="email"
            />
            <Field
              label="Support Phone"
              value={branding.support_phone || ''}
              onChange={(v) => setBranding({ ...branding, support_phone: v || null })}
              placeholder="+1-555-0123"
            />
            <Field
              label="Support URL"
              value={branding.support_url || ''}
              onChange={(v) => setBranding({ ...branding, support_url: v || null })}
              placeholder="https://support.example.com"
            />
          </div>
        </Section>

        {/* Footer */}
        <Section title="Footer Text">
          <div className="space-y-2">
            <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Footer</label>
            <textarea
              value={branding.footer_text || ''}
              onChange={(e) => setBranding({ ...branding, footer_text: e.target.value || null })}
              placeholder="© 2024 Your Company. All rights reserved."
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 resize-none"
              rows={3}
            />
            <p className="text-xs text-titanium-500">Max 1024 characters</p>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 disabled:opacity-50 text-white text-sm font-semibold rounded-none"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-titanium-300 text-sm rounded-none"
          >
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? 'Hide' : 'Preview'}
          </button>

          {success && (
            <span className="text-xs text-emerald-300 flex items-center gap-1 ml-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Preview */}
        {showPreview && (
          <Section title="Live Preview">
            <PreviewCard branding={branding} />
          </Section>
        )}
      </main>
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function Section({
  title, icon, children,
}: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-obsidian-900 border border-titanium-900 rounded-none p-5">
      <h2 className="font-display font-bold text-titanium-50 tracking-tight flex items-center gap-2">
        {icon}{title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
      />
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value);
  const [copied, setCopied] = useState(false);

  function handleChange(v: string) {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      onChange(v);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <div
          className="w-10 h-10 rounded-none border-2 border-titanium-700 shrink-0"
          style={{ backgroundColor: hex }}
        />
        <div className="flex-1 space-y-1">
          <input
            type="text"
            value={hex}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="#000000"
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500 font-mono"
          />
          <button
            onClick={copyToClipboard}
            className="text-xs text-titanium-500 hover:text-titanium-300 flex items-center gap-1"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ branding }: { branding: BrandingData }) {
  const colors = branding.brand_colors || DEFAULT_COLORS;

  return (
    <div
      className="p-6 rounded-none border border-titanium-700"
      style={{ backgroundColor: colors.background }}
    >
      <div className="space-y-4">
        {branding.custom_logo_url && (
          <img src={branding.custom_logo_url} alt="Logo" className="h-12 w-auto" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }} />
        )}

        <h1 className="font-bold text-2xl" style={{ color: colors.text }}>
          {branding.company_name || 'Your Company Name'}
        </h1>

        <div className="space-y-2">
          <h2 className="font-semibold" style={{ color: colors.primary }}>Dashboard Preview</h2>
          <p style={{ color: colors.text }}>This is how your branding will appear across the platform.</p>

          <div className="flex gap-2 pt-2">
            <button
              className="px-4 py-2 font-semibold text-white rounded-none"
              style={{ backgroundColor: colors.primary }}
            >
              Primary Action
            </button>
            <button
              className="px-4 py-2 font-semibold text-white rounded-none"
              style={{ backgroundColor: colors.accent }}
            >
              Accent
            </button>
          </div>
        </div>

        {(branding.support_email || branding.support_url) && (
          <div className="pt-4 border-t border-titanium-300" style={{ borderColor: colors.secondary + '40' }}>
            <p className="text-xs" style={{ color: colors.text }}>
              {branding.support_email && `Support: ${branding.support_email}`}
              {branding.support_email && branding.support_url && ' • '}
              {branding.support_url && (
                <a href={branding.support_url} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>
                  Help Center
                </a>
              )}
            </p>
          </div>
        )}

        {branding.footer_text && (
          <div className="text-xs pt-4" style={{ color: colors.text + '99' }}>
            {branding.footer_text}
          </div>
        )}
      </div>
    </div>
  );
}
