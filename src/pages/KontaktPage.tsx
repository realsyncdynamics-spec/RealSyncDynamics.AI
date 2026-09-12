import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * /kontakt — public contact alias.
 *
 * Reuses the working ContactSales surface (sales-lead) so we never ship a 404.
 * Preserves query params and forces source=kontakt when none is set.
 */
export function KontaktPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (!next.get('source') && !next.get('utm_source')) {
      next.set('source', 'kontakt');
    }
    const qs = next.toString();
    navigate(`/contact-sales${qs ? `?${qs}` : ''}`, { replace: true });
  }, [navigate, params]);

  return null;
}
