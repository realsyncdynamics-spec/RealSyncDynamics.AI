import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TrialCountdownBannerProps {
  trialEndDate: string | null;
  planName: string;
  onDismiss?: () => void;
}

export function TrialCountdownBanner({ trialEndDate, planName, onDismiss }: TrialCountdownBannerProps) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [urgency, setUrgency] = useState<'critical' | 'warning' | 'info'>('info');

  useEffect(() => {
    if (!trialEndDate) {
      setDaysRemaining(null);
      return;
    }

    const calculateDaysRemaining = () => {
      const now = new Date();
      const endDate = new Date(trialEndDate);
      const msPerDay = 24 * 60 * 60 * 1000;
      const remaining = Math.ceil((endDate.getTime() - now.getTime()) / msPerDay);

      setDaysRemaining(Math.max(0, remaining));

      // Determine urgency level
      if (remaining <= 3) {
        setUrgency('critical');
      } else if (remaining <= 7) {
        setUrgency('warning');
      } else {
        setUrgency('info');
      }
    };

    calculateDaysRemaining();
    const interval = setInterval(calculateDaysRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trialEndDate]);

  if (daysRemaining === null || daysRemaining < 0) {
    return null;
  }

  const urgencyConfig = {
    critical: {
      bg: 'bg-red-950/50',
      border: 'border-red-900',
      icon: 'text-red-400',
      text: 'text-red-300',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      bg: 'bg-amber-950/50',
      border: 'border-amber-900',
      icon: 'text-amber-400',
      text: 'text-amber-300',
      button: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      bg: 'bg-blue-950/50',
      border: 'border-blue-900',
      icon: 'text-blue-400',
      text: 'text-blue-300',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const config = urgencyConfig[urgency];

  const getMessage = () => {
    if (daysRemaining === 0) {
      return 'Deine Testphase endet heute!';
    } else if (daysRemaining === 1) {
      return 'Deine Testphase endet morgen!';
    } else {
      return `Deine Testphase endet in ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tagen'}`;
    }
  };

  return (
    <div className={`${config.bg} border ${config.border} rounded-none p-4 flex items-start gap-3`}>
      <Clock className={`h-5 w-5 ${config.icon} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold text-sm ${config.text} flex items-center gap-2`}>
          {urgency === 'critical' && <AlertCircle className="h-4 w-4" />}
          {getMessage()}
        </h3>
        <p className={`text-xs ${config.text} opacity-80 mt-1`}>
          Dein <span className="font-mono font-semibold">{planName}</span>-Plan läuft bald ab.
          Um nicht unterbrochen zu werden, bitte eine Zahlungsmethode hinzufügen.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/app/billing"
          className={`px-3 py-1.5 ${config.button} text-white text-xs font-semibold rounded-none flex items-center gap-1 whitespace-nowrap`}
        >
          Upgrade <ArrowRight className="h-3 w-3" />
        </Link>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`text-xs ${config.text} hover:opacity-70 px-2`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
