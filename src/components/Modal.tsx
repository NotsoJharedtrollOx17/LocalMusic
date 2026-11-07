import { useFocusScope } from "../ux/useFocusScope";
import { useRef, type ReactNode } from "react";
import { useBackLayer } from "../navigation";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useOverlayViewport } from "../ux/useOverlayViewport";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  compact = false,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  closeLabel?: string;
}) {
  useBackLayer(true, onClose);
  const ref = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useOverlayViewport(scrim);
  useFocusScope(ref);
  return (
    <div
      ref={scrim}
      className={"modal-scrim" + (compact ? " compact" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "modal" + (wide ? " wide" : "") + (compact ? " compact" : "")
        }
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
