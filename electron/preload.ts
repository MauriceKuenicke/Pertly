import { contextBridge, ipcRenderer } from "electron";

const api = {
  readStore: () => ipcRenderer.invoke("store:read"),
  writeStore: (data: unknown) => ipcRenderer.invoke("store:write", data),
  exportPdf: (payload: { html: string; suggestedName: string }) =>
    ipcRenderer.invoke("pdf:export", payload),
};

contextBridge.exposeInMainWorld("pertly", api);

export type PertlyApi = typeof api;
