import { useFocusScope } from "../ux/useFocusScope";
import { useRef, type ReactNode } from "react";
import { useBackLayer } from "../navigation";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  useBackLayer(true, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal" + (wide ? " wide" : "")}
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
