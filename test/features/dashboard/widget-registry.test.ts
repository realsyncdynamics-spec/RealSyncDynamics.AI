import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_KEYS } from '../../../shared/pricing';
import {
  WIDGET_CATALOG,
  WIDGET_CATALOG_BY_ID,
  selectWidgetsForEntitlements,
  START_CONNECTOR_IDS,
  WIDGET_FEATURE_FLAGS,
} from '../../../src/features/dashboard/widget-registry';

const ALL_KEYS = new Set<string>(ENTITLEMENT_KEYS);

describe('widget-registry catalog', () => {
  it('hat stabile, eindeutige IDs', () => {
    const ids = WIDGET_CATALOG.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('verwendet nur existierende Entitlement-Keys', () => {
    for (const widget of WIDGET_CATALOG) {
      for (const key of widget.requiredEntitlements) {
        expect(ALL_KEYS.has(key), `${widget.id} unknown key ${key}`).toBe(true);
      }
    }
  });

  it('setzt proposed Widgets ohne Komponentenpfad und available mit Pfad, außer dokumentierte Lücken', () => {
    for (const widget of WIDGET_CATALOG) {
      if (widget.status === 'proposed') {
        // connector_social hat eine Fläche, bleibt aber proposed: LinkedIn-OAuth fehlt.
        if (widget.id === 'connector_social') {
          expect(widget.componentPath).toBe(
            'src/features/dashboard/widget-registry/SocialChannelConnectPanel.tsx',
          );
          continue;
        }
        expect(widget.componentPath, widget.id).toBeNull();
      }
      if (widget.status === 'available') {
        expect(widget.componentPath, widget.id).toBeTruthy();
      }
    }
  });

  it('lässt connector_social proposed und außerhalb des Auto-Layouts', () => {
    const social = WIDGET_CATALOG_BY_ID.get('connector_social');
    expect(social?.status).toBe('proposed');
    expect(social?.requiredEntitlements).toEqual(['dashboard.access']);
    expect(social?.featureFlag).toBe('social_channel_connect');
    expect(social?.startConnector).toBe(true);
    expect(WIDGET_FEATURE_FLAGS.social_channel_connect).toBe(false);
    const selected = selectWidgetsForEntitlements(
      { 'dashboard.access': 1 },
      ['connector_social'],
    );
    expect(selected.map((w) => w.id)).not.toContain('connector_social');
  });

  it('enthält die Legacy-IDs aus dashboard_user_preferences', () => {
    for (const id of ['score_card', 'risk_summary', 'incidents', 'insights']) {
      expect(WIDGET_CATALOG_BY_ID.has(id)).toBe(true);
    }
  });
});

describe('selectWidgetsForEntitlements', () => {
  it('liefert ohne dashboard.access nichts', () => {
    expect(selectWidgetsForEntitlements({ 'bots.enabled': 1 })).toEqual([]);
  });

  it('liefert Default-Widgets bei dashboard.access und lässt proposed weg', () => {
    const selected = selectWidgetsForEntitlements({ 'dashboard.access': 1 });
    const ids = selected.map((w) => w.id);
    expect(ids).toContain('customer_start');
    expect(ids).toContain('governance_brief');
    expect(ids).toContain('score_card');
    expect(ids).not.toContain('briefing_mail');
    expect(ids).not.toContain('briefing_calendar');
    expect(ids).not.toContain('incidents');
    expect(ids).not.toContain('siteos');
    expect(selected.every((w) => w.status === 'available')).toBe(true);
  });

  it('nimmt siteos nur bei siteos.builder hinzu', () => {
    const without = selectWidgetsForEntitlements({ 'dashboard.access': 1 });
    const withBuilder = selectWidgetsForEntitlements({
      'dashboard.access': 1,
      'siteos.builder': 1,
    });
    expect(without.map((w) => w.id)).not.toContain('siteos');
    expect(withBuilder.map((w) => w.id)).toContain('siteos');
  });

  it('nimmt optionale available Widgets nur über preferredVisibleIds auf, proposed nie', () => {
    const selected = selectWidgetsForEntitlements(
      { 'dashboard.access': 1, 'alerts.email': 1 },
      ['notifications', 'briefing_mail', 'incidents'],
    );
    const ids = selected.map((w) => w.id);
    expect(ids).toContain('notifications');
    expect(ids).not.toContain('briefing_mail');
    expect(ids).not.toContain('incidents');
  });

  it('behandelt 0 als aus und -1 als an', () => {
    expect(
      selectWidgetsForEntitlements({ 'dashboard.access': 0 }).length,
    ).toBe(0);
    expect(
      selectWidgetsForEntitlements({ 'dashboard.access': -1 }).some((w) => w.id === 'customer_start'),
    ).toBe(true);
  });

  it('führt Gmail-Widgets nicht ins Auto-Layout, auch nicht über preferredVisibleIds', () => {
    const selected = selectWidgetsForEntitlements(
      { 'dashboard.access': 1 },
      ['briefing_mail', 'connector_gmail'],
    );
    const ids = selected.map((w) => w.id);
    expect(ids).not.toContain('briefing_mail');
    expect(ids).not.toContain('connector_gmail');
  });

  it('listet das Start-Set ohne Gmail', () => {
    expect(WIDGET_FEATURE_FLAGS.gmail_restricted_scopes).toBe(false);
    expect(WIDGET_FEATURE_FLAGS.social_channel_connect).toBe(false);
    expect(START_CONNECTOR_IDS).toEqual([
      'connector_google_calendar',
      'connector_microsoft_calendar',
      'connector_outlook_mail',
      'connector_social',
    ]);
    expect(START_CONNECTOR_IDS).not.toContain('connector_gmail');
  });
});
