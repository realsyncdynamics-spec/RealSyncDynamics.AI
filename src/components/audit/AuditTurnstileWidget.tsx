import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileOptions = {
  sitekey: string;
  action: 'audit_copilot';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function AuditTurnstileWidget({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey?: string;
  /** Increment after every submitted token; Turnstile tokens are single-use. */
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;

    onTokenRef.current(null);
    setLoadError(null);

    if (!siteKey) {
      const message = 'Turnstile-Site-Key fehlt (VITE_TURNSTILE_SITE_KEY).';
      setLoadError(message);
      return () => { cancelled = true; };
    }
    if (!container) return () => { cancelled = true; };

    const mountWidget = () => {
      if (cancelled || !container || !window.turnstile || widgetId) return;
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          action: 'audit_copilot',
          callback: (token) => {
            setLoadError(null);
            onTokenRef.current(token);
          },
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            const message = 'Turnstile konnte nicht verifiziert werden. Bitte erneut versuchen.';
            setLoadError(message);
          },
        });
      } catch {
        const message = 'Turnstile-Widget konnte nicht geladen werden.';
        setLoadError(message);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-audit-turnstile]');
    if (window.turnstile) {
      mountWidget();
    } else {
      const script = existing ?? document.createElement('script');
      const onLoad = () => {
        script.dataset.loaded = 'true';
        mountWidget();
      };
      const onScriptError = () => {
        if (cancelled) return;
        const message = 'Cloudflare Turnstile api.js wurde durch Netzwerk oder CSP blockiert.';
        setLoadError(message);
      };
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onScriptError, { once: true });
      if (!existing) {
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.dataset.auditTurnstile = 'true';
        document.head.appendChild(script);
      } else if (script.dataset.loaded === 'true') {
        mountWidget();
      }
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        data-sitekey={siteKey}
        data-action="audit_copilot"
        aria-label="Turnstile Bot-Schutz für den Audit-Copilot"
      />
      {loadError && <p role="alert" className="text-[10px] text-amber-300">{loadError}</p>}
      <p className="text-[10px] text-titanium-500">Bot-Schutz für den anonymen Audit-Copilot.</p>
    </div>
  );
}
