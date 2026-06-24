import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe2,
  Users,
  Settings,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { StatusBadge } from '../components/Badge';

type WizardStep = 'workspace' | 'websites' | 'team' | 'complete';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ReactNode;
  fields?: { label: string; placeholder: string; required?: boolean }[];
}

const STEPS: StepConfig[] = [
  {
    id: 'workspace',
    title: 'Workspace einrichten',
    description: 'Geben Sie den Namen Ihres Unternehmens ein.',
    icon: <Globe2 className="h-6 w-6" />,
    fields: [
      {
        label: 'Unternehmensname',
        placeholder: 'z.B. Acme GmbH',
        required: true,
      },
    ],
  },
  {
    id: 'websites',
    title: 'Websites hinzufügen',
    description: 'Welche Domains möchten Sie mit RealSync überwachen?',
    icon: <Globe2 className="h-6 w-6" />,
    fields: [
      {
        label: 'Erste Website URL',
        placeholder: 'https://example.de',
        required: true,
      },
    ],
  },
  {
    id: 'team',
    title: 'Team einladen (optional)',
    description: 'Laden Sie Ihr Team ein, um gemeinsam Compliance zu managen.',
    icon: <Users className="h-6 w-6" />,
    fields: [
      {
        label: 'E-Mail-Adresse des Teamkollegen',
        placeholder: 'kollege@example.de',
        required: false,
      },
    ],
  },
  {
    id: 'complete',
    title: 'Konfiguration abgeschlossen',
    description: 'Sie sind bereit, den Dashboard zu nutzen.',
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
  },
];

export function WelcomeWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('workspace');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const step = STEPS.find((s) => s.id === currentStep)!;
  const progress = ((STEPS.indexOf(step) + 1) / STEPS.length) * 100;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (currentStep === 'complete') {
      navigate('/os/app');
      return;
    }

    setLoading(true);
    // Simulate backend call
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);

    const nextIndex = STEPS.findIndex((s) => s.id === currentStep) + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id as WizardStep);
    }
  };

  const handleSkip = () => {
    navigate('/os/app');
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="border-b border-titanium-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
            Onboarding-Assistent
          </p>
          <h1 className="mt-1 font-display text-xl font-bold text-titanium-50">
            Willkommen bei RealSyncDynamics
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Bar */}
        <div className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-titanium-500">
              Schritt {STEPS.indexOf(step) + 1} von {STEPS.length}
            </span>
            <span className="text-xs text-titanium-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full bg-obsidian-800">
            <div
              className="h-full bg-security-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardHeader
            eyebrow="Schritt erforderlich"
            title={step.title}
            subtitle={step.description}
          />
          <CardBody>
            {step.id !== 'complete' ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNext();
                }}
              >
                {step.fields?.map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-titanium-300 mb-2">
                      {field.label}
                      {field.required && (
                        <span className="text-security-500 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={formData[field.label] || ''}
                      onChange={(e) =>
                        handleInputChange(field.label, e.target.value)
                      }
                      required={field.required}
                      className="w-full border border-titanium-800 bg-obsidian-900 px-4 py-3 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500 focus:ring-1 focus:ring-security-500"
                    />
                  </div>
                ))}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird verarbeitet…
                      </>
                    ) : (
                      <>
                        Weiter <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  {STEPS.indexOf(step) > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const prevIndex =
                          STEPS.findIndex((s) => s.id === currentStep) - 1;
                        setCurrentStep(
                          STEPS[prevIndex].id as WizardStep
                        );
                      }}
                    >
                      Zurück
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
                <p className="text-titanium-300 mb-6">
                  Ihre Einrichtung ist abgeschlossen. Sie können nun das
                  Dashboard nutzen und Ihre Governance starten.
                </p>
                <Button
                  variant="primary"
                  onClick={handleNext}
                  className="mx-auto"
                >
                  Zum Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Navigation */}
        {step.id !== 'complete' && (
          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-xs text-titanium-500 hover:text-titanium-300 transition-colors"
            >
              Überspringen und zum Dashboard gehen
            </button>
          </div>
        )}

        {/* Step Indicators */}
        <div className="mt-12 space-y-2">
          {STEPS.map((s, index) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 p-3 border ${
                s.id === currentStep
                  ? 'border-security-500 bg-security-500/5'
                  : index < STEPS.indexOf(step)
                    ? 'border-titanium-800 bg-obsidian-900'
                    : 'border-titanium-800 opacity-40'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  index < STEPS.indexOf(step)
                    ? 'bg-emerald-500 text-white'
                    : s.id === currentStep
                      ? 'border border-security-500 text-security-400'
                      : 'border border-titanium-600 text-titanium-500'
                }`}
              >
                {index < STEPS.indexOf(step) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-titanium-200">
                  {s.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default WelcomeWizardPage;
