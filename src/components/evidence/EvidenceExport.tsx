/**
 * Evidence Export — PDF Report Generation
 *
 * Component für das Exportieren von Evidence Items als PDF.
 * Nutzt @react-pdf/renderer für Rendering.
 */

import React, { useState } from 'react';
import { AlertCircle, Download, Loader } from 'lucide-react';
import { ProvenanceManifest } from '../../lib/provenance/verify';
import { EvidenceExportDocument } from './EvidenceExportDocument';
import { pdf } from '@react-pdf/renderer';

export interface EvidenceExportProps {
  manifest: ProvenanceManifest;
  tenantId: string;
  assetRef: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function EvidenceExport({
  manifest,
  tenantId,
  assetRef,
  onSuccess,
  onError,
}: EvidenceExportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate PDF blob
      const doc = <EvidenceExportDocument manifest={manifest} assetRef={assetRef} />;
      const blob = await pdf(doc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evidence-export-${assetRef}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 rounded bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        data-testid="export-evidence-button"
      >
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isLoading ? 'Exporting...' : 'Export as PDF'}
      </button>
    </div>
  );
}
