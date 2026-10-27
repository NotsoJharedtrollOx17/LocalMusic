import { FolderOpen, Check, X } from "lucide-react";
import { IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function AppFeedback() {
  const {
    notice,
    setNotice,
    error,
    setError,
    undoIds,
    setUndoIds,
    chooserOpen,
    t,
    act,
    changeVisibility,
    feedbackUndo,
    setFeedbackUndo,
    suggestionFeedback,
    feedbackPending,
  } = useMusicAppContext();

  return (
    <>
      {chooserOpen && (
        <div className="chooser-shield" role="status" aria-live="polite">
          <FolderOpen size={24} aria-hidden="true" />
          <span>{t.selectImportFolder}</span>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          {feedbackUndo &&
            (notice === t.suggestLessSaved ||
              notice === t.suggestionsRestored) && (
              <button
                className="text-button"
                disabled={feedbackPending}
                onClick={() => {
                  const previous = feedbackUndo;
                  setFeedbackUndo(null);
                  void suggestionFeedback(previous.id, previous.less);
                }}
              >
                {t.undo}
              </button>
            )}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <div>
            <strong>{t.error}</strong>
            <span>{error}</span>
          </div>
          <IconButton
            label={t.close}
            onClick={() => {
              const focused = document.activeElement?.closest(".error-banner");
              setError("");
              if (focused)
                document
                  .querySelector<HTMLElement>(
                    ".modal-scrim:not([inert]) .modal button,.player-scrim:not([inert]) button,.search-surface:not([inert]) input",
                  )
                  ?.focus({ preventScroll: true });
            }}
          >
            <X size={18} />
          </IconButton>
        </div>
      )}
      {undoIds.length > 0 && (
        <div className="undo-banner" role="status">
          <span>
            {undoIds.length} {t.removedLibrary}
          </span>
          <button
            className="text-button"
            onClick={() =>
              void act(async () => {
                await changeVisibility(undoIds, true);
                setUndoIds([]);
                setNotice(t.restoredLibrary);
              })
            }
          >
            {t.undo}
          </button>
          <IconButton label={t.close} onClick={() => setUndoIds([])}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </>
  );
}
