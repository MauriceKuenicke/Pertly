// Lets `vite dev` be opened directly in a plain browser tab for fast UI
// iteration, without spinning up Electron. Real runs always go through the
// preload bridge in electron/preload.ts, so window.pertly is already
// defined and this file does nothing.
let memoryStore: unknown = { estimates: [] };

export function installDevPreviewShimIfNeeded() {
  if (window.pertly) return;
  window.pertly = {
    readStore: async () => memoryStore,
    writeStore: async (data: unknown) => {
      memoryStore = data;
    },
    exportPdf: async () => {
      window.alert("PDF export only works inside the Electron app.");
      return { canceled: true };
    },
  };
}
