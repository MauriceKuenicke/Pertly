import { useRef, useState, type ChangeEvent } from "react";
import { Button, Card } from "../../components/ui";
import { useEstimates } from "../../state/EstimatesContext";
import styles from "./DesktopImport.module.css";

type Result = { kind: "success" | "error"; text: string };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** One-time migration: pulls estimates (and optionally defaults) out of a Pertly Desktop estimates.json. */
export function DesktopImport() {
  const { importDesktopStore } = useEstimates();
  const inputRef = useRef<HTMLInputElement>(null);
  const [replaceSettings, setReplaceSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON. Pick the estimates.json file from Pertly Desktop.");
      }
      const { imported, skipped, settingsReplaced } = importDesktopStore(data, { replaceSettings });
      const parts = [`Imported ${plural(imported, "estimate")}.`];
      if (skipped > 0) parts.push(`Skipped ${skipped} (already in your account, too large, or not a valid estimate).`);
      if (replaceSettings) parts.push(settingsReplaced ? "Your default settings were replaced." : "The file had no settings to import.");
      setResult({ kind: imported > 0 || settingsReplaced ? "success" : "error", text: parts.join(" ") });
    } catch (err) {
      setResult({ kind: "error", text: err instanceof Error ? err.message : "That file couldn't be imported." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Import From Pertly Desktop"
      description="Bring over everything from the desktop app's estimates.json (macOS: ~/Library/Application Support/Pertly, Windows: %APPDATA%\Pertly, Linux: ~/.config/Pertly). Estimates already in your account are skipped, so importing twice is safe."
    >
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={replaceSettings} onChange={(e) => setReplaceSettings(e.target.checked)} />
        Also replace my default settings
      </label>
      <input ref={inputRef} type="file" accept=".json,application/json" className={styles.fileInput} onChange={handleFile} />
      <div className={styles.actions}>
        <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Importing…" : "Choose estimates.json…"}
        </Button>
      </div>
      {result && (
        <p className={`${styles.result} ${result.kind === "error" ? styles.resultError : styles.resultSuccess}`} role="status">
          {result.text}
        </p>
      )}
    </Card>
  );
}
