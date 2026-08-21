import { useSearchParams } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { WowFunnel } from './WowFunnel';

export function PhotorealBuilderPage() {
  const [params] = useSearchParams();
  const initialUrl = params.get('url') || params.get('source_url') || params.get('domain') || '';

  return (
    <>
      <SEOHead
        title="Neue Website — erst sehen, dann 328 €"
        description="Fotorealistischer Rebuild Ihrer bestehenden Domain. Kein Konto vor der Vorschau. Umbau 249 € plus Betrieb 79 € — 328 € heute, danach das Abo."
        canonical="/builder"
      />
      <WowFunnel initialUrl={initialUrl} />
    </>
  );
}

export default PhotorealBuilderPage;
