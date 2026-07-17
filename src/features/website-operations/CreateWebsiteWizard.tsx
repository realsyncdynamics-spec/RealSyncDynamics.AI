/**
 * Create Website Wizard
 * Multi-step form for AI website generation
 * Steps: 1. Industry selection, 2. Company info, 3. Services, 4. Review & Generate
 */

import { useState } from 'react';
import { useSupabaseAuth } from '../../core/auth/useSupabaseAuth';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import './CreateWebsiteWizard.css';

interface WebsiteProject {
  id: string;
  name: string;
  industry: string;
  status: string;
}

interface CreateWebsiteWizardProps {
  onSuccess: (project: WebsiteProject) => void;
  onClose: () => void;
}

type Step = 'industry' | 'company' | 'services' | 'review';

export function CreateWebsiteWizard({ onSuccess, onClose }: CreateWebsiteWizardProps) {
  const { user, tenant } = useSupabaseAuth();
  const [step, setStep] = useState<Step>('industry');
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    industry: '',
    company_name: '',
    description: '',
    services: [] as string[],
    contact_email: user?.email || '',
    contact_phone: '',
    style_layout: 'modern',
  });

  const [serviceInput, setServiceInput] = useState('');

  const industries = [
    { id: 'tattoo-studio', name: 'Tattoo Studio' },
    { id: 'handwerker', name: 'Handwerksbetrieb' },
    { id: 'dienstleister', name: 'Dienstleister' },
    { id: 'einzelunternehmer', name: 'Einzelunternehmer' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!tenant?.id) {
      alert('Tenant information not found');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/functions/v1/website-operations-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          industry: formData.industry,
          company_name: formData.company_name,
          description: formData.description,
          services: formData.services,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          style_preferences: {
            layout: formData.style_layout,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status}`);
      }

      const result = await response.json();

      // Create project entry
      const projectResponse = await fetch('/api/website-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.id}`,
        },
        body: JSON.stringify(result),
      });

      if (!projectResponse.ok) {
        throw new Error('Failed to create project');
      }

      const project = await projectResponse.json();
      onSuccess(project);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }

  const addService = () => {
    if (serviceInput.trim()) {
      setFormData({
        ...formData,
        services: [...formData.services, serviceInput.trim()],
      });
      setServiceInput('');
    }
  };

  const removeService = (index: number) => {
    setFormData({
      ...formData,
      services: formData.services.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="create-website-wizard">
      <div className="wizard-header">
        <h2>Create Your Website</h2>
        <div className="step-indicator">
          {(['industry', 'company', 'services', 'review'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`step ${step === s ? 'active' : ''} ${i < (['industry', 'company', 'services', 'review'] as Step[]).indexOf(step) ? 'done' : ''}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="wizard-form">
        {/* Step 1: Industry Selection */}
        {step === 'industry' && (
          <div className="step-content">
            <h3>What's your business type?</h3>
            <div className="industry-grid">
              {industries.map((ind) => (
                <button
                  key={ind.id}
                  type="button"
                  className={`industry-card ${formData.industry === ind.id ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, industry: ind.id })}
                >
                  {ind.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Company Information */}
        {step === 'company' && (
          <div className="step-content">
            <h3>Company Information</h3>
            <Input
              label="Company Name"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
            <textarea
              placeholder="Brief description of your business"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="textarea"
            />
            <Input
              label="Email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
            <Input
              label="Phone (optional)"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
          </div>
        )}

        {/* Step 3: Services */}
        {step === 'services' && (
          <div className="step-content">
            <h3>Your Services</h3>
            <div className="service-input-group">
              <Input
                placeholder="Add a service..."
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
              />
              <button type="button" className="btn-secondary" onClick={addService}>
                Add
              </button>
            </div>
            <div className="services-list">
              {formData.services.map((service, i) => (
                <div key={i} className="service-chip">
                  {service}
                  <button type="button" onClick={() => removeService(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <Select
              label="Website Style"
              value={formData.style_layout}
              options={[
                { value: 'modern', label: 'Modern' },
                { value: 'traditional', label: 'Traditional' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'bold', label: 'Bold' },
              ]}
              onChange={(value) => setFormData({ ...formData, style_layout: value })}
            />
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className="step-content">
            <h3>Review Your Information</h3>
            <Card>
              <div className="review-section">
                <strong>Industry:</strong> {industries.find((i) => i.id === formData.industry)?.name}
              </div>
              <div className="review-section">
                <strong>Company:</strong> {formData.company_name}
              </div>
              {formData.description && (
                <div className="review-section">
                  <strong>Description:</strong> {formData.description}
                </div>
              )}
              <div className="review-section">
                <strong>Services:</strong> {formData.services.join(', ') || 'Not specified'}
              </div>
              <div className="review-section">
                <strong>Contact:</strong> {formData.contact_email}
              </div>
              <div className="review-section">
                <strong>Style:</strong> {formData.style_layout}
              </div>
            </Card>
            <p className="info-text">
              ℹ️ Your website will be generated using AI and checked for DSGVO compliance automatically.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="wizard-navigation">
          {step !== 'industry' && (
            <button type="button" className="btn-secondary" onClick={() => goToPreviousStep()}>
              ← Back
            </button>
          )}
          {step !== 'review' ? (
            <button type="button" className="btn-primary" onClick={() => goToNextStep()}>
              Next →
            </button>
          ) : (
            <button type="submit" className="btn-success" disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Website'}
            </button>
          )}
        </div>
      </form>
    </div>
  );

  function goToNextStep() {
    const steps: Step[] = ['industry', 'company', 'services', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  }

  function goToPreviousStep() {
    const steps: Step[] = ['industry', 'company', 'services', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  }
}
