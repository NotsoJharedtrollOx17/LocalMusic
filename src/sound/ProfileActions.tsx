import { useState, type RefObject } from "react";
import { ActionMenu } from "../ux/ActionMenu";
import { soundCopy } from "./copy";
export default function ProfileActions({
  buttonRef,
  language,
  disabled,
  onRename,
  onRetest,
  onDelete,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  language: string;
  disabled: boolean;
  onRename: () => void;
  onRetest: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false),
    t = soundCopy(language);
  return (
    <div>
      <button
        className="button secondary"
        ref={buttonRef}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t.manageProfile}
      </button>
      {open && buttonRef.current && (
        <ActionMenu
          anchor={buttonRef.current}
          label={t.manageProfile}
          onClose={() => setOpen(false)}
          items={[
            { label: t.rename, action: onRename },
            { label: t.retestProfile, action: onRetest },
            { label: t.remove, action: onDelete },
          ]}
        />
      )}
    </div>
  );
}
