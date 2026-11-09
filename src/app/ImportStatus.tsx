import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function ImportStatus() {
  const { importProgress, t, act } = useMusicAppContext();

  if (!importProgress) return null;
  return (
    <div
      className="import-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <LoaderCircle className="import-spinner" size={22} aria-hidden="true" />
      <div>
        <strong>
          {importProgress.phase === "checking"
            ? t.importChecking
            : importProgress.phase === "saving"
              ? t.importSaving
              : importProgress.phase === "refreshing"
                ? t.importRefreshing
                : t.importing}
        </strong>
        <span>
          {importProgress.phase === "checking"
            ? `${importProgress.scanned ?? 0}${importProgress.total != null ? ` ${t.of} ${importProgress.total}` : ""} ${t.importChecked}`
            : `${importProgress.imported} ${t.imported}`}
          {importProgress.failed > 0
            ? ` · ${importProgress.failed} ${t.importFailed}`
            : ""}
        </span>
      </div>
      <button
        className="text-button"
        disabled={
          importProgress.phase === "refreshing" || importProgress.cancelled
        }
        onClick={() => void act(() => api.cancelImport())}
      >
        {t.cancel}
      </button>
    </div>
  );
}
