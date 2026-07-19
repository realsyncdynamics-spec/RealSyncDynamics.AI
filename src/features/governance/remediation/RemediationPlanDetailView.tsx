import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, AlertTriangle, MessageSquare, GitPullRequest } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import {
  getRemediationPlan,
  prepareGithubIssue,
  preparePrComment,
} from './api';
import type { RemediationPlan } from './types';
import { RemediationReviewBanner } from './RemediationReviewBanner';
import { RemediationSnippetCard } from './RemediationSnippetCard';

function _RemediationPlanDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const RemediationPlanDetailView = withPerformanceMonitoring(
  _RemediationPlanDetailView,
  'RemediationPlanDetailView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  return <div className="p-8 text-titanium-400">View coming soon...</div>;
}
