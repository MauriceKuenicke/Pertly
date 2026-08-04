import { EstimatesProvider, useEstimates } from "./state/EstimatesContext";
import { AllEstimatesScreen } from "./screens/AllEstimates/AllEstimatesScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { AssumptionsScreen } from "./screens/Assumptions/AssumptionsScreen";
import { TimeMaterialsScreen } from "./screens/Pricing/TimeMaterialsScreen";
import { ValueBasedScreen } from "./screens/Pricing/ValueBasedScreen";
import { SummaryTMScreen } from "./screens/Summary/SummaryTMScreen";
import { SummaryVBPScreen } from "./screens/Summary/SummaryVBPScreen";
import { ShareScreen } from "./screens/Share/ShareScreen";
import type { WizardStep } from "./types/estimate";

function WizardRouter() {
  const {
    activeEstimate,
    updateActiveEstimate,
    goToList,
    goToSettings,
    createAndOpenEstimate,
    setStep,
    saveStatus,
    saveDraftAndGoToList,
    markActiveEstimateDone,
  } = useEstimates();

  if (!activeEstimate) return null;

  const savedLabel = saveStatus === "saving" ? "Saving…" : "Saved just now";
  const onChange = updateActiveEstimate;
  const onGoToList = goToList;
  const onStepClick = (step: WizardStep) => setStep(step);

  const shared = {
    estimate: activeEstimate,
    onChange,
    onGoToList,
    onGoToSettings: goToSettings,
    onNewEstimate: createAndOpenEstimate,
    onStepClick,
    savedLabel,
    onSaveDraft: saveDraftAndGoToList,
    onMarkDone: markActiveEstimateDone,
  };

  switch (activeEstimate.currentStep) {
    case 1:
      return <AssumptionsScreen {...shared} onNext={() => setStep(2)} />;
    case 2:
      return activeEstimate.pricingMethod === "time-materials" ? (
        <TimeMaterialsScreen {...shared} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      ) : (
        <ValueBasedScreen {...shared} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      );
    case 3:
      return activeEstimate.pricingMethod === "time-materials" ? (
        <SummaryTMScreen {...shared} onBack={() => setStep(2)} onNext={() => setStep(4)} />
      ) : (
        <SummaryVBPScreen {...shared} onBack={() => setStep(2)} onNext={() => setStep(4)} />
      );
    case 4:
      return <ShareScreen {...shared} onBack={() => setStep(3)} />;
    default:
      return null;
  }
}

function Shell() {
  const { view, loaded } = useEstimates();
  if (!loaded) return null;
  if (view === "settings") return <SettingsScreen />;
  return view === "list" ? <AllEstimatesScreen /> : <WizardRouter />;
}

export function App() {
  return (
    <EstimatesProvider>
      <Shell />
    </EstimatesProvider>
  );
}
