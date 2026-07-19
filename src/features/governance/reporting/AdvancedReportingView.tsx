import React, { useState } from 'react';
import {
  Plus, Trash2, AlertTriangle, CheckCircle2, Calendar, Download, Settings, X, FileText, Target,
} from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { useReportBuilder, type ReportConfig } from './useReportBuilder';
import { useCustomFrameworks } from '../frameworks/useCustomFrameworks';

function _AdvancedReportingView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AdvancedReportingView = withPerformanceMonitoring(
  _AdvancedReportingView,
  'AdvancedReportingView',
  { threshold: 500, maxRenders: 10 }
);
