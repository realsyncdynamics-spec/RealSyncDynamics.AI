import React, { useState } from 'react';
import {
  Users, Plus, UserCheck, UserX, Shield, Mail, LoaderCircle, AlertTriangle,
} from 'lucide-react';
import { useTeamMembers, type TeamMember } from './useTeamMembers';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';

const ROLE_INFO: Record<TeamMember['role'], { label: string; description: string; color: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full access, can manage members and billing',
    color: 'amber',
  },
  admin: {
    label: 'Admin',
    description: 'Full access to all compliance features',
    color: 'blue',
  },
  reviewer: {
    label: 'Reviewer',
    description: 'Can review and approve compliance items',
    color: 'emerald',
  },
  contributor: {
    label: 'Contributor',
    description: 'Can create and edit compliance items',
    color: 'cyan',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to compliance data',
    color: 'titanium',
  },
};

function _TeamManagementView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const TeamManagementView = withPerformanceMonitoring(
  _TeamManagementView,
  'TeamManagementView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  return <div className="p-8 text-titanium-400">View coming soon...</div>;
}
