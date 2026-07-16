import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, AlertCircle, Clock, User, MapPin, FileText,
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface CalendarDeadline {
  id: string;
  title: string;
  description: string;
  type: 'regulatory' | 'remediation' | 'audit' | 'certification';
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  assignedTo?: string;
  framework?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

function _ComplianceCalendarView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ComplianceCalendarView = withPerformanceMonitoring(
  _ComplianceCalendarView,
  'ComplianceCalendarView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1)); // July 2026
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'list'>('month');

  const [deadlines, setDeadlines] = useState<CalendarDeadline[]>([
    {
      id: 'd-001',
      title: 'NIS2 Implementation Deadline',
      description: 'Complete implementation of NIS2 requirements',
      type: 'regulatory',
      dueDate: '2026-10-17',
      status: 'in-progress',
      framework: 'NIS2',
      priority: 'critical',
      tags: ['regulatory', 'nis2', 'deadline'],
    },
    {
      id: 'd-002',
      title: 'ISO 27001 Annual Recertification',
      description: 'Recertification audit and documentation review',
      type: 'certification',
      dueDate: '2026-09-15',
      status: 'pending',
      framework: 'ISO 27001',
      priority: 'high',
      tags: ['certification', 'iso27001'],
    },
    {
      id: 'd-003',
      title: 'Q3 Compliance Report Generation',
      description: 'Generate quarterly compliance report for stakeholders',
      type: 'audit',
      dueDate: '2026-10-05',
      status: 'pending',
      priority: 'medium',
      tags: ['reporting', 'quarterly'],
      assignedTo: 'Compliance Officer',
    },
    {
      id: 'd-004',
      title: 'EU AI Act Risk Assessment Review',
      description: 'Complete risk assessment review for AI systems',
      type: 'regulatory',
      dueDate: '2026-08-30',
      status: 'in-progress',
      framework: 'AI Act',
      priority: 'high',
      tags: ['ai-act', 'risk-assessment'],
      assignedTo: 'Security Team',
    },
    {
      id: 'd-005',
      title: 'DSGVO Data Processing Agreement Review',
      description: 'Review and update all DPA with processors',
      type: 'regulatory',
      dueDate: '2026-09-01',
      status: 'completed',
      framework: 'DSGVO',
      priority: 'medium',
      tags: ['dsgvo', 'dpa'],
    },
  ]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatDateDisplay = (d: string) => new Date(d).toLocaleDateString('de-DE', { weekday: 'short', month: 'short', day: 'numeric' });

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const getDeadlinesForDate = (day: number) => {
    const dateStr = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    return deadlines.filter(d => d.dueDate === dateStr);
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'border-l-red-600 bg-red-900/10';
      case 'high': return 'border-l-amber-600 bg-amber-900/10';
      case 'medium': return 'border-l-cyan-600 bg-cyan-900/10';
      case 'low': return 'border-l-green-600 bg-green-900/10';
      default: return 'border-l-titanium-600 bg-titanium-900/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-400" />;
      default: return <AlertCircle className="h-4 w-4 text-titanium-500" />;
    }
  };

  const upcomingDeadlines = deadlines
    .filter(d => new Date(d.dueDate) >= currentMonth && new Date(d.dueDate) <= new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Compliance Calendar</div>
            <div className="text-[11px] text-titanium-400">Regulatory deadlines and milestones</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 font-semibold text-xs rounded-none transition-colors ${
              view === 'month'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 font-semibold text-xs rounded-none transition-colors ${
              view === 'list'
                ? 'bg-cyan-600 text-white'
                : 'text-titanium-400 hover:text-titanium-200'
            }`}
          >
            List
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {view === 'month' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-titanium-50 text-lg">{monthName}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-1.5 hover:bg-obsidian-800 rounded-none"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-1.5 hover:bg-obsidian-800 rounded-none"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-titanium-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square bg-obsidian-800/50 rounded-none" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayDeadlines = getDeadlinesForDate(day);
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth();

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                      className={`aspect-square rounded-none border text-sm font-semibold transition-colors flex flex-col items-center justify-center p-1 ${
                        isToday
                          ? 'border-cyan-600 bg-cyan-900/30'
                          : dayDeadlines.length > 0
                            ? 'border-amber-600 bg-amber-900/20'
                            : 'border-titanium-800 bg-obsidian-800 hover:border-titanium-700'
                      }`}
                    >
                      <span className="text-xs">{day}</span>
                      {dayDeadlines.length > 0 && (
                        <span className="text-[10px] text-amber-400 font-bold">{dayDeadlines.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar: Upcoming Deadlines */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400" />
                Upcoming Deadlines
              </h2>

              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-titanium-500">No upcoming deadlines this month</p>
              ) : (
                <div className="space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <div key={deadline.id} className={`border-l-4 rounded-none p-3 ${getPriorityColor(deadline.priority)}`}>
                      <div className="flex items-start gap-2 mb-1">
                        {getStatusIcon(deadline.status)}
                        <div className="flex-1">
                          <h3 className="text-xs font-semibold text-titanium-50 line-clamp-2">
                            {deadline.title}
                          </h3>
                        </div>
                      </div>
                      <div className="text-[10px] text-titanium-400">
                        {formatDateDisplay(deadline.dueDate)}
                      </div>
                      {deadline.assignedTo && (
                        <div className="text-[10px] text-titanium-500 mt-1">
                          Assigned to: {deadline.assignedTo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-3">
            {deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((deadline) => (
              <div key={deadline.id} className={`border-l-4 rounded-none border border-titanium-800 ${getPriorityColor(deadline.priority)} p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(deadline.status)}
                      <h3 className="font-semibold text-titanium-50">{deadline.title}</h3>
                      <span className="text-[10px] px-2 py-1 rounded-none bg-titanium-800/50 text-titanium-300 font-mono">
                        {deadline.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-titanium-400 mb-2">{deadline.description}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-titanium-500">
                        <Calendar className="h-3 w-3" />
                        {formatDateDisplay(deadline.dueDate)}
                      </span>
                      {deadline.framework && (
                        <span className="flex items-center gap-1 text-titanium-500">
                          <FileText className="h-3 w-3" />
                          {deadline.framework}
                        </span>
                      )}
                      {deadline.assignedTo && (
                        <span className="flex items-center gap-1 text-titanium-500">
                          <User className="h-3 w-3" />
                          {deadline.assignedTo}
                        </span>
                      )}
                    </div>
                    {deadline.tags.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {deadline.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-none bg-titanium-800/30 text-titanium-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-none ${
                      deadline.status === 'completed' ? 'bg-emerald-900/30 text-emerald-400' :
                      deadline.status === 'overdue' ? 'bg-red-900/30 text-red-400' :
                      deadline.status === 'in-progress' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-amber-900/30 text-amber-400'
                    }`}>
                      {deadline.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
