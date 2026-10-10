import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { EstimatesProvider, useEstimates } from "./state/EstimatesContext";
import { CenteredPage } from "./components/layout";
import { Button, Card } from "./components/ui";
import { AllEstimatesScreen } from "./screens/AllEstimates/AllEstimatesScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { AccountScreen } from "./screens/Account/AccountScreen";
import { UsersScreen } from "./screens/Users/UsersScreen";
import { LoginScreen } from "./screens/Auth/LoginScreen";
import { RegisterScreen } from "./screens/Auth/RegisterScreen";
import { SessionExpiredModal } from "./screens/Auth/SessionExpiredModal";
import { AssumptionsScreen } from "./screens/Assumptions/AssumptionsScreen";
import { TimeMaterialsScreen } from "./screens/Pricing/TimeMaterialsScreen";
import { ValueBasedScreen } from "./screens/Pricing/ValueBasedScreen";
import { SummaryTMScreen } from "./screens/Summary/SummaryTMScreen";
import { SummaryVBPScreen } from "./screens/Summary/SummaryVBPScreen";
import { ShareScreen } from "./screens/Share/ShareScreen";
import { saveStatusLabel } from "./lib/saveStatus";
import { useDocumentTitle } from "./lib/useDocumentTitle";
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
    saveRejection,
    saveDraftAndGoToList,
    markActiveEstimateDone,
  } = useEstimates();

  if (!activeEstimate) return null;

  const savedLabel = saveStatusLabel(saveStatus, saveRejection);
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

function ErrorPage({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  useDocumentTitle("Pertly");
  return (
    <CenteredPage>
      <Card title={title} description={message}>
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
      </Card>
    </CenteredPage>
  );
}

function Shell() {
  const { view, loaded, loadError, retryLoad } = useEstimates();
  if (!loaded) {
    return loadError ? <ErrorPage title="Couldn't Load Your Estimates" message={loadError} onRetry={retryLoad} /> : null;
  }
  switch (view) {
    case "settings":
      return <SettingsScreen />;
    case "account":
      return <AccountScreen />;
    case "users":
      return <UsersScreen />;
    case "list":
      return <AllEstimatesScreen />;
    default:
      return <WizardRouter />;
  }
}

function AuthGate() {
  const { user, initializing, initError, retryInit, registrationOpen, sessionExpired } = useAuth();
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");

  // Coming back from a sign-out always lands on the sign-in form.
  useEffect(() => {
    if (!user) setAuthScreen("login");
  }, [user]);

  if (initializing) return null;
  if (!user) {
    if (initError) return <ErrorPage title="Couldn't Reach Pertly" message={initError} onRetry={retryInit} />;
    if (authScreen === "register" && registrationOpen) return <RegisterScreen onGoToLogin={() => setAuthScreen("login")} />;
    return <LoginScreen onGoToRegister={registrationOpen ? () => setAuthScreen("register") : undefined} />;
  }

  return (
    <>
      {/* Keyed by user so a different user never sees the previous one's in-memory state. */}
      <EstimatesProvider key={user.id}>
        <Shell />
        {sessionExpired && <SessionExpiredModal />}
      </EstimatesProvider>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
