import { useLocation } from 'react-router-dom';
import { LandingV8Shell } from './LandingV8Shell';
import {
  LandingV8Demo,
  LandingV8Home,
  LandingV8Missing,
  LandingV8Pricing,
  LandingV8Product,
  LandingV8Products,
  LandingV8Solutions,
  LandingV8Start,
} from './LandingV8Pages';

/**
 * Interne Zuordnung unter `/v8/*`.
 * Die Pfade stehen nicht als eigene `path=`-Attribute in App.tsx, damit der
 * SPA-Routen-Sync keine relativen Muster wie `preise` als eigene URLs aufnimmt.
 */
export function LandingV8App() {
  const path = useLocation().pathname.replace(/\/$/, '') || '/';
  let page = <LandingV8Missing />;
  if (path === '/v8') page = <LandingV8Home />;
  else if (path === '/v8/produkte') page = <LandingV8Products />;
  else if (path.startsWith('/v8/produkte/')) page = <LandingV8Product slug={path.slice('/v8/produkte/'.length)} />;
  else if (path === '/v8/loesungen') page = <LandingV8Solutions />;
  else if (path === '/v8/preise') page = <LandingV8Pricing />;
  else if (path === '/v8/demo') page = <LandingV8Demo />;
  else if (path === '/v8/starten') page = <LandingV8Start />;

  return (
    <LandingV8Shell>
      {page}
    </LandingV8Shell>
  );
}
