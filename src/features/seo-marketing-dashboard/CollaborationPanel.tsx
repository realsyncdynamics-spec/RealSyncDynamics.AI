import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import {
  Share2,
  Lock,
  Eye,
  Edit,
  MessageSquare,
  Trash2,
  Copy,
  Check,
  Mail,
  Calendar,
  MoreVertical,
} from 'lucide-react';

interface DashboardShare {
  id: string;
  shared_with_user_id?: string;
  shared_with_email?: string;
  access_level: 'view' | 'edit' | 'comment' | 'manage';
  can_export: boolean;
  can_share: boolean;
  expires_at?: string;
  created_at: string;
}

interface Annotation {
  id: string;
  content: string;
  annotation_type: 'comment' | 'highlight' | 'issue' | 'insight';
  created_by: string;
  created_at: string;
  is_resolved: boolean;
}

export function CollaborationPanel() {
  const { session } = useSupabaseAuth();
  const { activeTenantId } = useTenant();
  const [shares, setShares] = useState<DashboardShare[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit' | 'comment' | 'manage'>('view');
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationType, setAnnotationType] = useState<'comment' | 'highlight' | 'issue' | 'insight'>('comment');

  useEffect(() => {
    loadShares();
    loadAnnotations();
  }, [activeTenantId]);

  async function loadShares() {
    if (!session?.access_token || !activeTenantId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_dashboard_shares?tenant_id=eq.${activeTenantId}&select=*`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShares(data);
      }
    } catch (error) {
      console.error('Failed to load shares:', error);
    }
  }

  async function loadAnnotations() {
    if (!session?.access_token || !activeTenantId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_dashboard_annotations?tenant_id=eq.${activeTenantId}&select=*&order=created_at.desc`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnnotations(data);
      }
    } catch (error) {
      console.error('Failed to load annotations:', error);
    }
  }

  async function shareWithEmail() {
    if (!session?.access_token || !activeTenantId || !shareEmail) return;

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-dashboard`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            dashboard_view_id: activeTenantId,
            shared_with_email: shareEmail,
            access_level: accessLevel,
          }),
        }
      );

      if (response.ok) {
        setShareEmail('');
        await loadShares();
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function revokeShare(shareId: string) {
    if (!session?.access_token) return;

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_dashboard_shares?id=eq.${shareId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      await loadShares();
    } catch (error) {
      console.error('Failed to revoke share:', error);
    }
  }

  async function addAnnotation() {
    if (!session?.access_token || !activeTenantId || !newAnnotation) return;

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_dashboard_annotations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            dashboard_view_id: activeTenantId,
            created_by: session.user?.id,
            annotation_type: annotationType,
            content: newAnnotation,
          }),
        }
      );

      setNewAnnotation('');
      await loadAnnotations();
    } catch (error) {
      console.error('Failed to add annotation:', error);
    }
  }

  function copyToClipboard(text: string, token: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const accessLevelIcons: Record<string, React.ReactNode> = {
    view: <Eye size={16} />,
    edit: <Edit size={16} />,
    comment: <MessageSquare size={16} />,
    manage: <Lock size={16} />,
  };

  const accessLevelLabels: Record<string, string> = {
    view: 'Ansehen',
    edit: 'Bearbeiten',
    comment: 'Kommentieren',
    manage: 'Verwalten',
  };

  return (
    <div className="space-y-6">
      {/* Share Dashboard Section */}
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Share2 size={16} className="text-security-blue" />
          <h3 className="text-titanium-200 font-mono text-sm">DASHBOARD TEILEN</h3>
        </div>

        <div className="space-y-4">
          {/* Share by Email */}
          <div className="space-y-2">
            <label className="text-titanium-300 text-xs font-mono block">E-Mail-Adresse</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 bg-obsidian-800 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue"
              />
              <select
                value={accessLevel}
                onChange={e => setAccessLevel(e.target.value as any)}
                className="bg-obsidian-800 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue"
              >
                {Object.entries(accessLevelLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={shareWithEmail}
            disabled={loading || !shareEmail}
            className="w-full bg-security-blue text-titanium-50 px-4 py-2 rounded-sm font-mono text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Wird geteilt...' : 'Teilen'}
          </button>
        </div>

        {/* Active Shares */}
        {shares.length > 0 && (
          <div className="mt-6 border-t border-obsidian-700 pt-4">
            <h4 className="text-titanium-300 font-mono text-xs mb-3">AKTIVE FREIGABEN ({shares.length})</h4>

            <div className="space-y-2">
              {shares.map(share => (
                <div key={share.id} className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {accessLevelIcons[share.access_level]}
                        <span className="text-titanium-50 font-mono text-sm">
                          {share.shared_with_email || 'Benutzer'}
                        </span>
                      </div>
                      <div className="text-titanium-400 text-xs font-mono mb-1">
                        {accessLevelLabels[share.access_level]} • Export: {share.can_export ? 'Ja' : 'Nein'}
                      </div>
                      {share.expires_at && (
                        <div className="text-titanium-500 text-xs font-mono flex items-center gap-1">
                          <Calendar size={12} />
                          Verfällt: {new Date(share.expires_at).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => revokeShare(share.id)}
                      className="p-2 hover:bg-obsidian-700 rounded-sm transition-colors"
                      title="Freigabe widerrufen"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Annotations Section */}
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-titanium-400" />
          <h3 className="text-titanium-200 font-mono text-sm">ANMERKUNGEN & KOMMENTARE</h3>
        </div>

        {/* Add New Annotation */}
        <div className="space-y-2 mb-4 p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
          <select
            value={annotationType}
            onChange={e => setAnnotationType(e.target.value as any)}
            className="w-full bg-obsidian-700 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue"
          >
            <option value="comment">Kommentar</option>
            <option value="highlight">Highlight</option>
            <option value="issue">Problem</option>
            <option value="insight">Einsicht</option>
          </select>

          <textarea
            value={newAnnotation}
            onChange={e => setNewAnnotation(e.target.value)}
            placeholder="Anmerkung hinzufügen..."
            rows={2}
            className="w-full bg-obsidian-700 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue resize-none"
          />

          <button
            onClick={addAnnotation}
            disabled={!newAnnotation}
            className="w-full bg-security-blue text-titanium-50 px-4 py-2 rounded-sm font-mono text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Anmerkung hinzufügen
          </button>
        </div>

        {/* Existing Annotations */}
        {annotations.length > 0 && (
          <div className="space-y-2">
            {annotations.slice(0, 5).map(annotation => (
              <div
                key={annotation.id}
                className={`p-3 border rounded-sm ${
                  annotation.annotation_type === 'issue'
                    ? 'bg-red-950 border-red-700'
                    : annotation.annotation_type === 'insight'
                      ? 'bg-blue-950 border-blue-700'
                      : 'bg-obsidian-800 border-obsidian-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-titanium-300 text-xs font-mono uppercase">
                    {annotation.annotation_type}
                  </span>
                  {annotation.is_resolved && (
                    <Check size={14} className="text-green-500" />
                  )}
                </div>
                <p className="text-titanium-200 text-sm font-mono mb-1">{annotation.content}</p>
                <div className="text-titanium-500 text-xs font-mono">
                  {new Date(annotation.created_at).toLocaleDateString('de-DE')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collaboration Info */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-sm p-4">
        <div className="space-y-2 text-titanium-400 text-xs font-mono">
          <div>
            <strong>Zugriffsebenen:</strong>
          </div>
          <ul className="space-y-1 ml-3">
            <li>• <strong>Ansehen:</strong> Nur Lesezugriff auf Dashboard-Daten</li>
            <li>• <strong>Bearbeiten:</strong> Dashboard-Einstellungen ändern</li>
            <li>• <strong>Kommentieren:</strong> Anmerkungen hinzufügen und mit anderen diskutieren</li>
            <li>• <strong>Verwalten:</strong> Vollständiger Zugriff, einschließlich Freigabe</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
