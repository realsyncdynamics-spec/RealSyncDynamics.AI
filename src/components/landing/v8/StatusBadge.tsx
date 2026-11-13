import type { MarketingFeature } from '../../../marketing/products/types';

export function StatusBadge({ feature }: { feature: MarketingFeature }) {
  if (feature.demo) {
    return <span className="v8-badge v8-badge-demo">Demo</span>;
  }
  if (feature.status === 'in-entwicklung') {
    return <span className="v8-badge v8-badge-preview">In Entwicklung</span>;
  }
  if (feature.status === 'vorschau') {
    return <span className="v8-badge v8-badge-preview">Vorschau</span>;
  }
  return <span className="v8-badge v8-badge-ok">Vorhanden</span>;
}
