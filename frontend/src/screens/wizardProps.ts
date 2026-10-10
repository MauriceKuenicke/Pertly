import type { Estimate, WizardStep } from "../types/estimate";

export interface WizardScreenProps {
  estimate: Estimate;
  onChange: (updater: (estimate: Estimate) => Estimate) => void;
  onGoToList: () => void;
  onNewEstimate: () => void;
  onGoToSettings: () => void;
  onStepClick: (step: WizardStep) => void;
  savedLabel: string;
  onBack?: () => void;
  onNext?: () => void;
  onSaveDraft: () => void;
  onMarkDone: () => void;
}

export function windowTitleFor(estimate: Estimate): string {
  const name = estimate.projectDetails.estimateName || "New estimate";
  const client = estimate.projectDetails.clientName;
  return client ? `Pertly - ${name} (${client})` : `Pertly - ${name}`;
}

export function breadcrumbLabelFor(estimate: Estimate): string {
  return estimate.projectDetails.estimateName || "New estimate";
}
