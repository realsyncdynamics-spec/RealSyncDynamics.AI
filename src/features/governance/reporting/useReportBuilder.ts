import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: 'compliance' | 'audit' | 'executive' | 'remediation';
  framework: string;
  frameworkIds: string[];
  sections: ReportSection[];
  includeMetrics: boolean;
  includeEvidence: boolean;
  includeTrends: boolean;
  includeRisks: boolean;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  status: 'draft' | 'generated' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  generatedAt: Date | null;
  fileUrl?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'controls' | 'evidence' | 'metrics' | 'recommendations' | 'executive_summary';
  includeCharts: boolean;
  includeDetails: boolean;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  fileFormat: 'pdf' | 'docx' | 'xlsx';
  fileSize: number;
  fileUrl: string;
  generatedAt: Date;
  expiresAt: Date;
  downloadCount: number;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: '1', title: 'Executive Summary', type: 'executive_summary', includeCharts: true, includeDetails: false },
  { id: '2', title: 'Framework Overview', type: 'summary', includeCharts: true, includeDetails: true },
  { id: '3', title: 'Control Assessment', type: 'controls', includeCharts: true, includeDetails: true },
  { id: '4', title: 'Evidence & Documentation', type: 'evidence', includeCharts: false, includeDetails: true },
  { id: '5', title: 'Compliance Metrics', type: 'metrics', includeCharts: true, includeDetails: true },
  { id: '6', title: 'Recommendations', type: 'recommendations', includeCharts: false, includeDetails: true },
];

/**
 * Hook for building and generating compliance reports.
 * Supports multiple frameworks and custom configurations.
 */
export function useReportBuilder() {
  const { activeTenantId } = useTenant();
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('report_configurations')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedReports: ReportConfig[] = (data || []).map((report) => ({
        id: report.id,
        name: report.name,
        description: report.description || '',
        type: report.type || 'compliance',
        framework: report.framework || '',
        frameworkIds: report.framework_ids || [],
        sections: report.sections || DEFAULT_SECTIONS,
        includeMetrics: report.include_metrics !== false,
        includeEvidence: report.include_evidence !== false,
        includeTrends: report.include_trends !== false,
        includeRisks: report.include_risks !== false,
        dateRange: {
          startDate: new Date(report.start_date),
          endDate: new Date(report.end_date),
        },
        status: report.status || 'draft',
        createdAt: new Date(report.created_at),
        updatedAt: new Date(report.updated_at),
        generatedAt: report.generated_at ? new Date(report.generated_at) : null,
        fileUrl: report.file_url,
      }));

      setReports(transformedReports);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch reports';
      setError(errorMsg);
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  const fetchGeneratedReports = useCallback(
    async (configId?: string) => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return;
      }

      try {
        const sb = getSupabase();

        let query = sb
          .from('generated_reports')
          .select('*')
          .eq('tenant_id', activeTenantId);

        if (configId) {
          query = query.eq('config_id', configId);
        }

        const { data, error: fetchError } = await query.order('generated_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        const transformedReports: GeneratedReport[] = (data || []).map((report) => ({
          id: report.id,
          configId: report.config_id,
          fileFormat: report.file_format,
          fileSize: report.file_size,
          fileUrl: report.file_url,
          generatedAt: new Date(report.generated_at),
          expiresAt: new Date(report.expires_at),
          downloadCount: report.download_count || 0,
        }));

        setGeneratedReports(transformedReports);
      } catch (err) {
        console.error('Generated reports fetch error:', err);
      }
    },
    [activeTenantId]
  );

  const createReport = useCallback(
    async (
      report: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt' | 'generatedAt'>
    ): Promise<ReportConfig | null> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return null;
      }

      try {
        const sb = getSupabase();

        const { data, error } = await sb
          .from('report_configurations')
          .insert({
            tenant_id: activeTenantId,
            name: report.name,
            description: report.description,
            type: report.type,
            framework: report.framework,
            framework_ids: report.frameworkIds,
            sections: report.sections,
            include_metrics: report.includeMetrics,
            include_evidence: report.includeEvidence,
            include_trends: report.includeTrends,
            include_risks: report.includeRisks,
            start_date: report.dateRange.startDate.toISOString(),
            end_date: report.dateRange.endDate.toISOString(),
            status: report.status,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const newReport: ReportConfig = {
            id: data.id,
            name: data.name,
            description: data.description || '',
            type: data.type,
            framework: data.framework,
            frameworkIds: data.framework_ids || [],
            sections: data.sections || DEFAULT_SECTIONS,
            includeMetrics: data.include_metrics !== false,
            includeEvidence: data.include_evidence !== false,
            includeTrends: data.include_trends !== false,
            includeRisks: data.include_risks !== false,
            dateRange: {
              startDate: new Date(data.start_date),
              endDate: new Date(data.end_date),
            },
            status: data.status,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            generatedAt: null,
          };

          await fetchReports();
          return newReport;
        }
      } catch (err) {
        console.error('Failed to create report:', err);
      }

      return null;
    },
    [activeTenantId, fetchReports]
  );

  const updateReport = useCallback(
    async (id: string, updates: Partial<ReportConfig>): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error } = await sb
          .from('report_configurations')
          .update({
            name: updates.name,
            description: updates.description,
            type: updates.type,
            framework: updates.framework,
            framework_ids: updates.frameworkIds,
            sections: updates.sections,
            include_metrics: updates.includeMetrics,
            include_evidence: updates.includeEvidence,
            include_trends: updates.includeTrends,
            include_risks: updates.includeRisks,
            status: updates.status,
          })
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchReports();
        return true;
      } catch (err) {
        console.error('Failed to update report:', err);
        return false;
      }
    },
    [activeTenantId, fetchReports]
  );

  const deleteReport = useCallback(
    async (id: string): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error } = await sb
          .from('report_configurations')
          .delete()
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchReports();
        return true;
      } catch (err) {
        console.error('Failed to delete report:', err);
        return false;
      }
    },
    [activeTenantId, fetchReports]
  );

  const generateReport = useCallback(
    async (configId: string, format: 'pdf' | 'docx' | 'xlsx' = 'pdf'): Promise<GeneratedReport | null> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return null;
      }

      try {
        const sb = getSupabase();

        // Call Edge Function to generate report
        const { data, error } = await sb.functions.invoke('generate-compliance-report', {
          body: {
            configId,
            format,
            tenantId: activeTenantId,
          },
        });

        if (error) {
          throw error;
        }

        if (data) {
          await fetchGeneratedReports(configId);
          return data;
        }
      } catch (err) {
        console.error('Failed to generate report:', err);
      }

      return null;
    },
    [activeTenantId, fetchGeneratedReports]
  );

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  return {
    reports,
    generatedReports,
    loading,
    error,
    createReport,
    updateReport,
    deleteReport,
    generateReport,
    refetchReports: fetchReports,
    refetchGeneratedReports: fetchGeneratedReports,
  };
}
