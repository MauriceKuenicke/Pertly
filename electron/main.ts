import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStore, writeStore } from "./persistence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.setName("Pertly");

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    backgroundColor: "#f5f0ec",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay:
      process.platform === "darwin"
        ? undefined
        : { color: "#ede3e0", symbolColor: "#6b5450", height: 40 },
    trafficLightPosition: { x: 20, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("store:read", () => readStore());
ipcMain.handle("store:write", (_event, data) => writeStore(data));

ipcMain.handle("pdf:export", async (_event, { html, suggestedName }: { html: string; suggestedName: string }) => {
  if (!mainWindow) return { canceled: true };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export PDF",
    defaultPath: suggestedName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { canceled: true };

  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "none" },
    });
    const { promises: fs } = await import("node:fs");
    await fs.writeFile(filePath, pdfBuffer);
    return { canceled: false, filePath };
  } finally {
    printWindow.destroy();
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
