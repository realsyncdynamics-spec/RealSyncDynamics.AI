import React from 'react';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  completed?: boolean;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  variant?: 'horizontal' | 'vertical';
  onStepClick?: (index: number) => void;
}

export const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ steps, currentStep, variant = 'horizontal', onStepClick }, ref) => {
    const isVertical = variant === 'vertical';

    return (
      <div ref={ref} className={isVertical ? 'space-y-4' : ''}>
        <div
          className={`flex ${
            isVertical ? 'flex-col' : 'items-center justify-between'
          } gap-4`}
        >
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onStepClick?.(index)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-semibold transition-all ${
                    index < currentStep
                      ? 'bg-green-500 text-white border-2 border-green-600'
                      : index === currentStep
                      ? 'bg-security-blue text-white border-2 border-security-blue ring-2 ring-security-blue/30'
                      : 'bg-titanium/10 text-titanium border-2 border-titanium/30'
                  }`}
                >
                  {index < currentStep ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                <p className="font-mono font-semibold text-titanium mt-2 text-center">
                  {step.label}
                </p>
                {step.description && (
                  <p className="font-mono text-sm text-titanium/60 text-center mt-1">
                    {step.description}
                  </p>
                )}
              </div>

              {!isVertical && index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-colors ${
                    index < currentStep ? 'bg-green-500' : 'bg-titanium/20'
                  }`}
                />
              )}

              {isVertical && index < steps.length - 1 && (
                <div
                  className={`w-1 h-8 mx-auto transition-colors ${
                    index < currentStep ? 'bg-green-500' : 'bg-titanium/20'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
);

Stepper.displayName = 'Stepper';
