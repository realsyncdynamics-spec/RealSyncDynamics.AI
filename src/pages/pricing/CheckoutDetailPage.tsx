import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { CheckoutPlanPage } from '../../components/pricing/CheckoutPlanPage';
import { ALL_PLAN_SLUGS } from '../../content/pricingContent';

export function CheckoutDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Remove trailing slash if present (React Router may include it)
  const cleanSlug = slug?.replace(/\/$/, '');

  if (!cleanSlug || !ALL_PLAN_SLUGS.includes(cleanSlug)) {
    return (
      <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-8 max-w-md text-center">
          <div className="inline-block mb-4 text-4xl">❌</div>
          <h1 className="text-2xl font-bold text-titanium-50 mb-2">Unbekanntes Paket</h1>
          <p className="text-titanium-300 mb-8">
            Der angeforderte Plan konnte nicht gefunden werden.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/pricing')}
              className="w-full px-6 py-3 bg-security-500 text-white font-bold uppercase hover:bg-security-600"
            >
              Zur Plan-Auswahl
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-obsidian-700 text-titanium-50 border border-titanium-600 font-bold uppercase hover:bg-obsidian-600"
            >
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <CheckoutPlanPage planSlug={cleanSlug} />;
}
