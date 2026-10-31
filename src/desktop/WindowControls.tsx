import { ExternalLink, PanelTopClose, Pin, PinOff } from "lucide-react";
import { IconButton } from "../components";
import { usePlayerContext } from "../app/PlayerContext";
import {
  companionView,
  desktop,
  useDesktopWindows,
  type DetachedView,
} from "./windows";
export default function WindowControls({ view }: { view: DetachedView }) {
  const { t, modal, act } = usePlayerContext();
  const state = useDesktopWindows();
  if (!state.supported) return null;
  const entry = state.windows.find((e) => e.view === view),
    detached = companionView === view;
  return (
    <div className="window-controls" data-window-controls>
      <IconButton
        label={detached ? t.returnToMain : t.detachWindow}
        disabled={entry?.phase === "opening" || entry?.phase === "transferring"}
        onClick={() =>
          void act(() =>
            desktop.action(
              detached
                ? { op: "return", view }
                : { op: "open", view, queue: modal === "queue" },
            ),
          )
        }
      >
        {detached ? <PanelTopClose size={20} /> : <ExternalLink size={20} />}
      </IconButton>
      {detached && (
        <IconButton
          label={t.alwaysOnTop}
          active={entry?.pinned ?? false}
          onClick={() =>
            void act(() =>
              desktop.action({ op: "pin", view, value: !entry?.pinned }),
            )
          }
        >
          {entry?.pinned ? <PinOff size={20} /> : <Pin size={20} />}
        </IconButton>
      )}
    </div>
  );
}
