import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Estimate, Settings, Store, WizardStep } from "../types/estimate";
import { cloneEstimate, createEstimate } from "../lib/newEstimate";
import { defaultSettings } from "../lib/settings";

type View = "list" | "wizard" | "settings";
type SaveStatus = "idle" | "saving" | "saved";

interface EstimatesContextValue {
  estimates: Estimate[];
  settings: Settings;
  view: View;
  activeEstimateId: string | null;
  activeEstimate: Estimate | null;
  saveStatus: SaveStatus;
  loaded: boolean;
  goToList: () => void;
  goToSettings: () => void;
  createAndOpenEstimate: () => void;
  duplicateEstimate: (id: string) => void;
  openEstimate: (id: string) => void;
  deleteEstimate: (id: string) => void;
  updateActiveEstimate: (updater: (estimate: Estimate) => Estimate) => void;
  updateSettings: (updater: (settings: Settings) => Settings) => void;
  setStep: (step: WizardStep) => void;
  saveDraftAndGoToList: () => void;
  markActiveEstimateDone: () => void;
}

const EstimatesContext = createContext<EstimatesContextValue | null>(null);

export function EstimatesProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({ estimates: [], settings: defaultSettings() });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("list");
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  // A newly created estimate lives here, not in `store`, until the user
  // finishes step 1 (Continue or Save as draft). This keeps abandoned
  // "New estimate" clicks from polluting the Estimates list.
  const [draftEstimate, setDraftEstimate] = useState<Estimate | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.pertly.readStore().then((data) => {
      const loadedStore = data as Partial<Store>;
      setStore({
        estimates: loadedStore.estimates ?? [],
        settings: { ...defaultSettings(), ...loadedStore.settings },
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.pertly.writeStore(store).then(() => setSaveStatus("saved"));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, loaded]);

  const goToList = useCallback(() => {
    setDraftEstimate(null);
    setView("list");
    setActiveEstimateId(null);
  }, []);

  const goToSettings = useCallback(() => {
    setDraftEstimate(null);
    setView("settings");
    setActiveEstimateId(null);
  }, []);

  const createAndOpenEstimate = useCallback(() => {
    const estimate = createEstimate(store.settings);
    setDraftEstimate(estimate);
    setActiveEstimateId(estimate.id);
    setView("wizard");
  }, [store.settings]);

  const duplicateEstimate = useCallback(
    (id: string) => {
      const source = store.estimates.find((e) => e.id === id);
      if (!source) return;
      const cloned = cloneEstimate(source);
      setStore((s) => ({ ...s, estimates: [cloned, ...s.estimates] }));
      setDraftEstimate(null);
      setActiveEstimateId(cloned.id);
      setView("wizard");
    },
    [store.estimates],
  );

  const openEstimate = useCallback((id: string) => {
    setDraftEstimate(null);
    setActiveEstimateId(id);
    setView("wizard");
  }, []);

  const deleteEstimate = useCallback((id: string) => {
    setStore((s) => ({ ...s, estimates: s.estimates.filter((e) => e.id !== id) }));
  }, []);

  const isEditingDraft = draftEstimate !== null && draftEstimate.id === activeEstimateId;

  const updateActiveEstimate = useCallback(
    (updater: (estimate: Estimate) => Estimate) => {
      if (isEditingDraft) {
        setDraftEstimate((d) => (d ? { ...updater(d), updatedAt: new Date().toISOString() } : d));
        return;
      }
      setStore((s) => ({
        ...s,
        estimates: s.estimates.map((e) => {
          if (e.id !== activeEstimateId) return e;
          const updated = updater(e);
          // Any content edit invalidates a previously "done" estimate.
          const status = e.status === "done" ? "draft" : updated.status;
          return { ...updated, status, updatedAt: new Date().toISOString() };
        }),
      }));
    },
    [activeEstimateId, isEditingDraft],
  );

  const updateSettings = useCallback((updater: (settings: Settings) => Settings) => {
    setStore((s) => ({ ...s, settings: updater(s.settings) }));
  }, []);

  const setStep = useCallback(
    (step: WizardStep) => {
      if (isEditingDraft && draftEstimate) {
        if (step > 1) {
          const toSave = { ...draftEstimate, currentStep: step, updatedAt: new Date().toISOString() };
          setStore((s) => ({ ...s, estimates: [toSave, ...s.estimates] }));
          setDraftEstimate(null);
          return;
        }
        setDraftEstimate((d) => (d ? { ...d, currentStep: step } : d));
        return;
      }
      updateActiveEstimate((e) => ({ ...e, currentStep: step }));
    },
    [draftEstimate, isEditingDraft, updateActiveEstimate],
  );

  const saveDraftAndGoToList = useCallback(() => {
    if (draftEstimate) {
      const toSave = { ...draftEstimate, updatedAt: new Date().toISOString() };
      setStore((s) => ({ ...s, estimates: [toSave, ...s.estimates] }));
    }
    setDraftEstimate(null);
    setView("list");
    setActiveEstimateId(null);
  }, [draftEstimate]);

  const markActiveEstimateDone = useCallback(() => {
    setStore((s) => ({
      ...s,
      estimates: s.estimates.map((e) =>
        e.id === activeEstimateId ? { ...e, status: "done", updatedAt: new Date().toISOString() } : e,
      ),
    }));
  }, [activeEstimateId]);

  const activeEstimate = useMemo(() => {
    if (isEditingDraft) return draftEstimate;
    return store.estimates.find((e) => e.id === activeEstimateId) ?? null;
  }, [store.estimates, activeEstimateId, isEditingDraft, draftEstimate]);

  const value: EstimatesContextValue = {
    estimates: store.estimates,
    settings: store.settings,
    view,
    activeEstimateId,
    activeEstimate,
    saveStatus,
    loaded,
    goToList,
    goToSettings,
    createAndOpenEstimate,
    duplicateEstimate,
    openEstimate,
    deleteEstimate,
    updateActiveEstimate,
    updateSettings,
    setStep,
    saveDraftAndGoToList,
    markActiveEstimateDone,
  };

  return <EstimatesContext.Provider value={value}>{children}</EstimatesContext.Provider>;
}

export function useEstimates() {
  const ctx = useContext(EstimatesContext);
  if (!ctx) throw new Error("useEstimates must be used within EstimatesProvider");
  return ctx;
}
