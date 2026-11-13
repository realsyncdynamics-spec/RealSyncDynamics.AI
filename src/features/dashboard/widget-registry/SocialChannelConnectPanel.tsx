import { useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useTenantLoad } from '../../governance/handoff/useTenantLoad';
import { listSocialChannelConnections, removeSocialChannelConnection, type SocialChannelConnectionMeta } from './socialChannelConnectApi';
import {
  SOCIAL_CHANNEL_OFFERS,
  canManageSocialChannels,
  socialDisplayName,
  socialExpiryLabel,
  socialStatusLabel,
} from './socialChannelConnectModel';

const PLACEHOLDER_CONNECT =
  'Platzhalter: LinkedIn-OAuth ist nicht angebunden. Es wurde kein Token abgefragt und nichts gespeichert.';
const PLACEHOLDER_ROTATE =
  'Platzhalter: Rotieren braucht einen neuen Token aus dem LinkedIn-OAuth. Es wurde nichts gespeichert.';

/**
 * Social-Konten unter „Konten verbinden“.
 * Metadaten aus `social_channel_connections`, Trennen über
 * `social-channel-connect` (`op: remove`). Verbinden und Rotieren bleiben
 * Platzhalter, solange der Code-Tausch fehlt.
 */
export function SocialChannelConnectPanel({
  reloadKey = 0,
  onRetry,
}: {
  reloadKey?: number;
  onRetry?: () => void;
}) {
  const { activeTenantId, tenants } = useTenant();
  const role = tenants.find((tenant) => tenant.tenantId === activeTenantId)?.role ?? null;
  const canManage = canManageSocialChannels(role);
  const [state, reload] = useTenantLoad(activeTenantId, listSocialChannelConnections, [reloadKey]);
  const [placeholder, setPlaceholder] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!activeTenantId) return null;
  const tenantId = activeTenantId;

  const retry = () => {
    setActionError(null);
    if (onRetry) onRetry();
    else reload();
  };

  async function confirmRemove(connectionId: string) {
    setBusy(true);
    setActionError(null);
    try {
      await removeSocialChannelConnection(tenantId, connectionId);
      setPendingId(null);
      setPlaceholder(null);
      reload();
    } catch {
      setActionError('Trennen ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rs-panel" data-testid="social-channel-connect" aria-labelledby="social-channel-connect-title">
      <h2 id="social-channel-connect-title" className="rs-h3">Social-Konten</h2>
      <p className="rs-note">
        Verbundene Konten zeigen Kanal, Anzeigename, Status und Ablaufdatum.
        Tokens bleiben auf dem Server. LinkedIn ist der einzige aktive Kanal;
        ohne OAuth-Code-Tausch sind Verbinden und Rotieren ein Platzhalter.
        X, Instagram, TikTok und Facebook sind in Entwicklung.
      </p>
      {!canManage && (
        <p className="rs-note" data-testid="social-channel-role-note">
          Verbinden, Rotieren und Trennen sind Inhabern und Admins vorbehalten. Die Liste bleibt lesbar.
        </p>
      )}
      <ul className="rs-start__steps" aria-label="Social-Kanäle">
        {SOCIAL_CHANNEL_OFFERS.map((offer) => (
          <li
            key={offer.id}
            className="rs-start__step"
            data-testid={`social-channel-${offer.id}`}
            data-availability={offer.availability}
          >
            <span className="min-w-0 flex-1">
              <strong>{offer.label}</strong>
              {offer.availability === 'placeholder' ? (
                <span className="rs-note"> — Platzhalter, OAuth fehlt</span>
              ) : (
                <span className="rs-note"> — in Entwicklung</span>
              )}
            </span>
            {offer.availability === 'placeholder' && canManage && (
              <button
                type="button"
                className="border px-3 py-1.5 text-xs font-semibold"
                data-testid="social-linkedin-connect"
                onClick={() => setPlaceholder(PLACEHOLDER_CONNECT)}
              >
                Verbinden
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3 className="rs-h3">Verbundene Konten</h3>
      {state.status === 'idle' || state.status === 'loading' ? (
        <p className="rs-note" data-testid="social-channel-connect-loading">Social-Konten werden geladen.</p>
      ) : null}
      {state.status === 'error' ? (
        <div role="alert" data-testid="social-channel-connect-error">
          <p className="rs-note">Social-Konten konnten nicht geladen werden.</p>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold"
            data-testid="social-channel-connect-retry"
            onClick={retry}
          >
            Erneut laden
          </button>
        </div>
      ) : null}
      {state.status === 'ready' && state.data.length === 0 ? (
        <p className="rs-note" data-testid="social-channel-connect-empty">Noch kein Social-Konto verbunden.</p>
      ) : null}
      {state.status === 'ready' && state.data.length > 0 ? (
        <ul className="rs-start__steps" data-testid="social-channel-connect-list">
          {state.data.map((row) => (
            <ConnectionRow
              key={row.id}
              row={row}
              canManage={canManage}
              pending={pendingId === row.id}
              busy={busy}
              onRotate={() => setPlaceholder(PLACEHOLDER_ROTATE)}
              onAskRemove={() => {
                setActionError(null);
                setPendingId(row.id);
              }}
              onCancelRemove={() => setPendingId(null)}
              onConfirmRemove={() => { void confirmRemove(row.id); }}
            />
          ))}
        </ul>
      ) : null}
      {placeholder ? (
        <p className="rs-note" role="status" data-testid="social-oauth-placeholder">{placeholder}</p>
      ) : null}
      {actionError ? (
        <p className="rs-note" role="alert" data-testid="social-channel-action-error">{actionError}</p>
      ) : null}
    </section>
  );
}

function ConnectionRow({
  row,
  canManage,
  pending,
  busy,
  onRotate,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  row: SocialChannelConnectionMeta;
  canManage: boolean;
  pending: boolean;
  busy: boolean;
  onRotate: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const offer = SOCIAL_CHANNEL_OFFERS.find((item) => item.id === row.channel);
  const channelLabel = offer?.label ?? row.channel;
  const disconnected = row.status === 'revoked';
  return (
    <li className="rs-start__step" data-testid={`social-connection-${row.id}`}>
      <span className="min-w-0 flex-1">
        <strong>{channelLabel}</strong>
        <span className="rs-note"> — {socialDisplayName(row.account_name)}</span>
        {row.account_name?.trim() ? null : (
          <span className="rs-note rs-mono"> — Kennung {row.account_external_id}</span>
        )}
        <span className="rs-note rs-mono"> — {socialStatusLabel(row.status)}</span>
        <span className="rs-note rs-mono"> — {socialExpiryLabel(row.token_expires_at)}</span>
      </span>
      {canManage && row.channel === 'linkedin' && !disconnected && (
        <button
          type="button"
          className="border px-3 py-1.5 text-xs font-semibold"
          data-testid={`social-connection-rotate-${row.id}`}
          onClick={onRotate}
        >
          Rotieren
        </button>
      )}
      {canManage && !disconnected && !pending && (
        <button
          type="button"
          className="border px-3 py-1.5 text-xs font-semibold"
          data-testid={`social-connection-disconnect-${row.id}`}
          onClick={onAskRemove}
        >
          Trennen
        </button>
      )}
      {canManage && pending && (
        <>
          <button
            type="button"
            className="border px-3 py-1.5 text-xs font-semibold"
            data-testid={`social-connection-disconnect-confirm-${row.id}`}
            disabled={busy}
            onClick={onConfirmRemove}
          >
            Trennen bestätigen
          </button>
          <button
            type="button"
            className="border px-3 py-1.5 text-xs font-semibold"
            data-testid={`social-connection-disconnect-cancel-${row.id}`}
            disabled={busy}
            onClick={onCancelRemove}
          >
            Abbrechen
          </button>
        </>
      )}
    </li>
  );
}
