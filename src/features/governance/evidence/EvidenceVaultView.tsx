/**
 * Evidence Vault — Governance Operating System
 * Hauptansicht für DSGVO- und EU-AI-Act-Nachweise.
 * Kein Demo-Fallback: ohne Login leer, nach Login nur Mandanten-Daten.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  countTenantEvidence,
  countTenantEvidenceHashed,
  countTenantEvidenceSince,
  fetchTenantEvents,
  fetchTenantEvidence,
} from '../governanceApi';
import { listTimeline } from '../../evidence-vault/evidenceVaultApi';
import { ChainIntegrityPanel } from './ChainIntegrityPanel';
import {
  exportAnalytics,
  triggerBlobDownload,
  buildExportFilename,
  defaultRange,
  type ExportFormat,
} from '../audit/auditExportApi';
import {
  Camera,
  Shield,
  FileText,
  Activity,
  Edit,
  Cpu,
  Download,
  Bot,
  User,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Eye,
  GitCompare,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import {
  computeVaultMetrics,
  eventToAuditEntry,
  eventToChangeEntry,
  mergeTimeline,
  timelineToSnapshot,
  type AuditEntry,
  type AuditOutcome,
  type ActorType,
  type ChangeEntry,
  type ChangeSeverity,
  type ChangeType,
  type EvidenceItem,
  type EvidenceType,
  type Snapshot,
} from './evidenceVaultData';
