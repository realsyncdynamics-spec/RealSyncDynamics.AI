import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isFixtureTenantPath } from '../../core/access/fixtureTenants';
import { useTenant } from '../../core/access/TenantProvider';

/** Schaltet Fixture-Mandanten nur auf den Vorschau-Pfaden an und wieder aus. */
export function TenantFixtureSync() {
  const { pathname } = useLocation();
  const { fixturePreview, setFixturePreview } = useTenant();
  const want = isFixtureTenantPath(pathname);

  useEffect(() => {
    if (want !== fixturePreview) setFixturePreview(want);
  }, [want, fixturePreview, setFixturePreview]);

  return null;
}
