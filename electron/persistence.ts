import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

// All app data lives in one JSON file inside Electron's per-user data
// directory (~/Library/Application Support/Pertly, %APPDATA%/Pertly, or
// ~/.config/Pertly). Nothing is written anywhere else on disk.
const dataDir = app.getPath("userData");
const dataFile = path.join(dataDir, "estimates.json");

export async function readStore(): Promise<unknown> {
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { estimates: [] };
    throw err;
  }
}

export async function writeStore(data: unknown): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  const tmpFile = `${dataFile}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpFile, dataFile);
}
