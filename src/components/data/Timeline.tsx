import React from 'react';

export interface TimelineItemProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  completed?: boolean;
  active?: boolean;
}

export const TimelineItem = ({
  title,
  description,
  icon,
  completed = false,
  active = false,
}: TimelineItemProps) => (
  <div className="flex gap-4 pb-8 last:pb-0">
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
          completed
            ? 'bg-green-500 border-green-600 text-white'
            : active
            ? 'bg-security-blue border-security-blue text-white'
            : 'bg-titanium/10 border-titanium/30 text-titanium'
        }`}
      >
        {icon || (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
      </div>
      <div className="w-0.5 h-16 bg-titanium/20 my-2 last:hidden" />
    </div>
    <div className="pt-1.5">
      <p className="font-mono font-semibold text-titanium">{title}</p>
      {description && (
        <p className="font-mono text-sm text-titanium/60 mt-1">{description}</p>
      )}
    </div>
  </div>
);

interface TimelineProps {
  items: TimelineItemProps[];
}

export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ items }, ref) => (
    <div ref={ref} className="relative">
      {items.map((item, index) => (
        <TimelineItem key={index} {...item} />
      ))}
    </div>
  )
);

Timeline.displayName = 'Timeline';
