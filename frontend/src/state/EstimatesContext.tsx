import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Estimate, Settings, Store, WizardStep } from "../types/estimate";
import { cloneEstimate, createEstimate, normalizeEstimate } from "../lib/newEstimate";
import { defaultSettings } from "../lib/settings";
import { estimatesApi, isApiError, settingsApi, type SyncRequestOptions } from "../lib/api";
import { friendlyErrorMessage, isPermanentRejection } from "../lib/apiErrors";
import {
  confirmedStore,
  diffStore,
  emptyRejected,
  firstRejection,
  isEmptyDiff,
  pruneRejected,
  withoutRejected,
  type Rejection,
  type SaveRejection,
} from "../lib/storeDiff";
import { planDesktopImport } from "../lib/desktopImport";
import type { SaveStatus } from "../lib/saveStatus";
import { useAuth } from "./AuthContext";

export type View = "list" | "wizard" | "settings" | "account" | "users";

export interface DesktopImportResult {
  imported: number;
  skipped: number;
  /** True if the file had settings and they replaced the current defaults. */
  settingsReplaced: boolean;
}

// Delay before each automatic retry of a failed sync; the last value repeats.
const RETRY_BACKOFF_MS = [1000, 2000, 5000, 10000];
const SAVE_DEBOUNCE_MS = 400;

interface EstimatesContextValue {
  estimates: Estimate[];
  settings: Settings;
  view: View;
  activeEstimateId: string | null;
  activeEstimate: Estimate | null;
  saveStatus: SaveStatus;
  /** What the server permanently refused (shown while saveStatus is "rejected"). */
  saveRejection: SaveRejection | null;
  loaded: boolean;
  /** Set when the initial load from the server failed; `retryLoad` tries again. */
  loadError: string | null;
  retryLoad: () => void;
  goToList: () => void;
  goToSettings: () => void;
  goToAccount: () => void;
  goToUsers: () => void;
  createAndOpenEstimate: () => void;
  duplicateEstimate: (id: string) => void;
  addImportedEstimate: (estimate: Estimate) => void;
  openEstimate: (id: string) => void;
  deleteEstimate: (id: string) => void;
  updateActiveEstimate: (updater: (estimate: Estimate) => Estimate) => void;
  updateSettings: (updater: (settings: Settings) => Settings) => void;
  setStep: (step: WizardStep) => void;
  saveDraftAndGoToList: () => void;
  markActiveEstimateDone: () => void;
  /** Cancels the save debounce and syncs everything to the server now. Never rejects. */
  flushPendingSaves: () => Promise<void>;
  /** True while a sync is in flight or the store differs from what the server last confirmed. */
  hasUnsyncedChanges: () => boolean;
  /** Adds the estimates (and optionally settings) from a Pertly Desktop estimates.json. Throws on a malformed file. */
  importDesktopStore: (data: unknown, options: { replaceSettings: boolean }) => DesktopImportResult;
}

const EstimatesContext = createContext<EstimatesContextValue | null>(null);

export function EstimatesProvider({ children }: { children: ReactNode }) {
  const { registerBeforeLogout, sessionExpired } = useAuth();
  const [store, setStore] = useState<Store>({ estimates: [], settings: defaultSettings() });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [view, setView] = useState<View>("list");
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  // A newly created estimate lives here, not in `store`, until the user
  // finishes step 1 (Continue or Save as draft). This keeps abandoned
  // "New estimate" clicks from polluting the Estimates list. Because it's
  // never in `store`, it's never synced to the server either.
  const [draftEstimate, setDraftEstimate] = useState<Estimate | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveRejection, setSaveRejection] = useState<SaveRejection | null>(null);

  // --- server sync state (refs: the sync loop must always see the latest values) ---
  const storeRef = useRef(store);
  storeRef.current = store;
  /** The store exactly as the server last confirmed it; diffs are computed against this. */
  const lastSyncedRef = useRef<Store | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  /** A sync hit 401: hold off until the user signs in again. */
  const pausedForAuthRef = useRef(false);
  /** Set on unmount (sign-out / user switch) so no request is sent on the wrong session. */
  const disposedRef = useRef(false);
  const runSyncRef = useRef<(options?: SyncRequestOptions) => Promise<void>>(() => Promise.resolve());
  /** Changes the server refused for good; skipped until the user edits them again. */
  const rejectedRef = useRef(emptyRejected());
  /** Set when a save-on-exit flush wants every remaining request of the current run sent with keepalive. */
  const keepaliveRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      retryTimerRef.current = null;
      debounceRef.current = null;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoadError(null);
    Promise.all([estimatesApi.list(), settingsApi.get()]).then(
      ([estimates, settingsDoc]) => {
        if (ignore) return;
        const loadedStore: Store = {
          estimates: estimates.map(normalizeEstimate),
          settings: { ...defaultSettings(), ...settingsDoc },
        };
        // Same object as the state below, so the first diff is empty and
        // the normalization backfills aren't pushed back to the server.
        lastSyncedRef.current = loadedStore;
        setStore(loadedStore);
        setLoaded(true);
      },
      (err) => {
        if (!ignore) setLoadError(friendlyErrorMessage(err));
      },
    );
    return () => {
      ignore = true;
    };
  }, [loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  /**
   * Pushes everything that differs from `lastSyncedRef` to the server:
   * upserts (in diffStore order), then deletes, then settings. Only one sync
   * runs at a time; a call while one is in flight joins it, and the running
   * loop re-diffs against the latest store before it finishes.
   *
   * Failure handling:
   * - 401: pause until the user signs in again (see the sessionExpired effect).
   * - permanent 4xx (413, 422, ...): remember the rejected object, carry on
   *   with everything else, and don't resend it until it's edited again.
   * - network / 5xx / 408 / 429: retry the whole run with backoff.
   */
  const runSync = useCallback((options: SyncRequestOptions = {}): Promise<void> => {
    if (syncPromiseRef.current) {
      if (options.keepalive) keepaliveRef.current = true;
      return syncPromiseRef.current;
    }
    if (disposedRef.current || !lastSyncedRef.current) return Promise.resolve();
    if (pausedForAuthRef.current) {
      setSaveStatus("error");
      return Promise.resolve();
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    keepaliveRef.current = options.keepalive === true;

    // Checked before every request: never send anything after unmount, or
    // while the session is expired (the next sign-in may be another user).
    const assertActive = () => {
      if (disposedRef.current || pausedForAuthRef.current) throw new Error("Sync cancelled");
    };
    const requestOptions = (): SyncRequestOptions => ({ keepalive: keepaliveRef.current });
    const rejectionOf = (err: unknown): Rejection => ({
      code: isApiError(err) ? err.code : "UNKNOWN",
      message: friendlyErrorMessage(err),
    });

    const sync = async () => {
      try {
        for (;;) {
          const base = lastSyncedRef.current!;
          const snapshot = storeRef.current;
          rejectedRef.current = pruneRejected(rejectedRef.current, snapshot);
          const rejected = rejectedRef.current;
          const diff = withoutRejected(diffStore(base, snapshot), rejected, snapshot);
          for (const estimate of diff.upserts) {
            assertActive();
            try {
              await estimatesApi.put(estimate, requestOptions());
              rejected.estimates.delete(estimate.id);
            } catch (err) {
              if (!isPermanentRejection(err)) throw err;
              rejected.estimates.set(estimate.id, { estimate, rejection: rejectionOf(err) });
            }
          }
          for (const id of diff.deletes) {
            assertActive();
            try {
              await estimatesApi.remove(id, requestOptions());
            } catch (err) {
              // Already gone on the server: that's the state we wanted.
              if (isApiError(err) && err.status === 404) continue;
              if (!isPermanentRejection(err)) throw err;
              rejected.deletes.set(id, rejectionOf(err));
            }
          }
          if (diff.settingsChanged) {
            assertActive();
            try {
              await settingsApi.put(snapshot.settings, requestOptions());
            } catch (err) {
              if (!isPermanentRejection(err)) throw err;
              rejected.settings = { settings: snapshot.settings, rejection: rejectionOf(err) };
            }
          }
          lastSyncedRef.current = confirmedStore(base, snapshot, rejected);
          retryAttemptRef.current = 0;
          const rejection = firstRejection(rejected);
          if (!disposedRef.current) setSaveRejection(rejection);
          // A newer edit is still debouncing: its timer will sync it (and
          // set the status) when it fires.
          if (debounceRef.current) return;
          const latest = storeRef.current;
          if (isEmptyDiff(withoutRejected(diffStore(lastSyncedRef.current, latest), pruneRejected(rejected, latest), latest))) {
            if (!disposedRef.current) setSaveStatus(rejection ? "rejected" : "saved");
            return;
          }
        }
      } catch (err) {
        if (disposedRef.current) return;
        setSaveStatus("error");
        if (pausedForAuthRef.current || (isApiError(err) && err.status === 401)) {
          // Resumed by the sessionExpired effect once the user signs in again.
          pausedForAuthRef.current = true;
          return;
        }
        const delay = RETRY_BACKOFF_MS[Math.min(retryAttemptRef.current, RETRY_BACKOFF_MS.length - 1)];
        retryAttemptRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          void runSyncRef.current();
        }, delay);
      } finally {
        syncPromiseRef.current = null;
        keepaliveRef.current = false;
      }
    };

    // Deferred by a microtask so syncPromiseRef is set before `sync` can
    // reach its `finally` (an empty diff never awaits anything).
    const promise = Promise.resolve().then(sync);
    syncPromiseRef.current = promise;
    return promise;
  }, []);
  runSyncRef.current = runSync;

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus(pausedForAuthRef.current ? "error" : "saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runSync();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [store, loaded, runSync]);

  const flushWith = useCallback(
    async (options: SyncRequestOptions = {}) => {
      if (!lastSyncedRef.current) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // An in-flight sync re-diffs against the latest store before it
      // finishes (no debounce is pending any more), so joining it is enough.
      await runSync(options);
    },
    [runSync],
  );

  const flushPendingSaves = useCallback(() => flushWith(), [flushWith]);

  const hasUnsyncedChanges = useCallback(() => {
    const base = lastSyncedRef.current;
    if (!base) return false;
    return syncPromiseRef.current !== null || !isEmptyDiff(diffStore(base, storeRef.current));
  }, []);

  // Sign-out flushes first, so nothing typed in the last 400ms is lost.
  useEffect(() => registerBeforeLogout(flushPendingSaves), [registerBeforeLogout, flushPendingSaves]);

  // After an expired session is renewed (same user), resume where we stopped.
  const wasSessionExpired = useRef(false);
  useEffect(() => {
    if (sessionExpired) {
      // Any request's 401 (not just a sync's): stop sending immediately and
      // drop pending timers, so nothing can fire on whoever signs in next.
      wasSessionExpired.current = true;
      pausedForAuthRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      debounceRef.current = null;
      retryTimerRef.current = null;
      if (lastSyncedRef.current) setSaveStatus("error");
      return;
    }
    if (!wasSessionExpired.current) return;
    wasSessionExpired.current = false;
    if (!lastSyncedRef.current) {
      retryLoad();
      return;
    }
    pausedForAuthRef.current = false;
    retryAttemptRef.current = 0;
    void runSync();
  }, [sessionExpired, runSync, retryLoad]);

  // Leaving the tab: push pending edits right away instead of waiting out
  // the debounce. keepalive lets small requests finish if the tab closes.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && hasUnsyncedChanges()) void flushWith({ keepalive: true });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsyncedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushWith, hasUnsyncedChanges]);

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

  const goToAccount = useCallback(() => {
    setDraftEstimate(null);
    setView("account");
    setActiveEstimateId(null);
  }, []);

  const goToUsers = useCallback(() => {
    setDraftEstimate(null);
    setView("users");
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

  const addImportedEstimate = useCallback((estimate: Estimate) => {
    setStore((s) => ({ ...s, estimates: [estimate, ...s.estimates] }));
    setDraftEstimate(null);
    setActiveEstimateId(estimate.id);
    setView("wizard");
  }, []);

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
          const toSave = {
            ...draftEstimate,
            currentStep: step,
            furthestStep: Math.max(draftEstimate.furthestStep, step) as WizardStep,
            updatedAt: new Date().toISOString(),
          };
          setStore((s) => ({ ...s, estimates: [toSave, ...s.estimates] }));
          setDraftEstimate(null);
          return;
        }
        setDraftEstimate((d) => (d ? { ...d, currentStep: step, furthestStep: Math.max(d.furthestStep, step) as WizardStep } : d));
        return;
      }
      updateActiveEstimate((e) => ({ ...e, currentStep: step, furthestStep: Math.max(e.furthestStep, step) as WizardStep }));
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

  const importDesktopStore = useCallback(
    (data: unknown, options: { replaceSettings: boolean }): DesktopImportResult => {
      const plan = planDesktopImport(
        data,
        storeRef.current.estimates.map((e) => e.id),
      );
      const settingsReplaced = options.replaceSettings && plan.settings !== null;
      if (plan.estimates.length > 0 || settingsReplaced) {
        setStore((s) => {
          const existing = new Set(s.estimates.map((e) => e.id));
          const toAdd = plan.estimates.filter((e) => !existing.has(e.id));
          return {
            // Prepended in file order, so the file's first estimate ends up
            // on top, exactly where it was in the desktop app.
            estimates: toAdd.length > 0 ? [...toAdd, ...s.estimates] : s.estimates,
            settings: settingsReplaced ? { ...defaultSettings(), ...plan.settings } : s.settings,
          };
        });
      }
      return { imported: plan.estimates.length, skipped: plan.skipped, settingsReplaced };
    },
    [],
  );

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
    saveRejection,
    loaded,
    loadError,
    retryLoad,
    goToList,
    goToSettings,
    goToAccount,
    goToUsers,
    createAndOpenEstimate,
    duplicateEstimate,
    addImportedEstimate,
    openEstimate,
    deleteEstimate,
    updateActiveEstimate,
    updateSettings,
    setStep,
    saveDraftAndGoToList,
    markActiveEstimateDone,
    flushPendingSaves,
    hasUnsyncedChanges,
    importDesktopStore,
  };

  return <EstimatesContext.Provider value={value}>{children}</EstimatesContext.Provider>;
}

export function useEstimates() {
  const ctx = useContext(EstimatesContext);
  if (!ctx) throw new Error("useEstimates must be used within EstimatesProvider");
  return ctx;
}
