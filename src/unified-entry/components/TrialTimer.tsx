import { useEffect, useState } from 'react';

interface TrialTimerProps {
  durationMinutes?: number;
  onExpire?: () => void;
  showCountdown?: boolean;
}

export function TrialTimer({
  durationMinutes = 30,
  onExpire,
  showCountdown = true,
}: TrialTimerProps) {
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0 && !isExpired) {
          setIsExpired(true);
          onExpire?.();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isEndingSoon = remaining < 300; // Last 5 minutes

  if (!showCountdown) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        isExpired
          ? 'bg-red-900/20 border border-red-700 text-red-300'
          : isEndingSoon
            ? 'bg-amber-900/20 border border-amber-700 text-amber-300'
            : 'bg-green-900/20 border border-green-700 text-green-300'
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span>
        Preview verfällt in {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
