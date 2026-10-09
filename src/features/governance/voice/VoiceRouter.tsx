/**
 * Primary /app/voice experience — list or session detail.
 * Mounted behind AppGate + GovernanceBrowserShell (see App.tsx).
 */
import { useParams } from 'react-router-dom';
import { usePerformanceMonitor } from '../../../lib/performance';
import { VoiceSessionsView } from './VoiceSessionsView';
import { VoiceSessionDetailView } from './VoiceSessionDetailView';

export function VoiceRouter() {
  usePerformanceMonitor('VoiceRouter', { threshold: 500 });
  const { sessionId } = useParams<{ sessionId?: string }>();
  if (sessionId) {
    return <VoiceSessionDetailView sessionId={sessionId} />;
  }
  return <VoiceSessionsView />;
}
