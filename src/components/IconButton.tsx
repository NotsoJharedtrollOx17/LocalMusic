import { type ReactNode, type MouseEvent } from "react";

export function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  hasMenu = false,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  hasMenu?: boolean;
}) {
  return (
    <button
      type="button"
      className={"icon-button" + (active ? " active" : "")}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      aria-haspopup={hasMenu ? "menu" : undefined}
      aria-expanded={hasMenu ? false : undefined}
    >
      {children}
    </button>
  );
}
