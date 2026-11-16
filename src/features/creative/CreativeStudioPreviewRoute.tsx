import { useTenant } from '../../core/access/TenantProvider';
import { CreativeImagePreview } from './CreativeImagePreview';

export default function CreativeStudioPreviewRoute() {
  const { activeTenantId, loading, error } = useTenant();
  if (loading) return <p role="status">Creative Studio wird vorbereitet …</p>;
  if (error) return <p role="alert">Mandant konnte nicht geladen werden.</p>;
  if (!activeTenantId) {
    return <section className="p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">Creative Studio · Vorschau</h1>
      <p className="mt-3">Bitte wähle zuerst einen Arbeitsbereich aus.</p>
    </section>;
  }
  return <CreativeImagePreview tenantId={activeTenantId} />;
}
