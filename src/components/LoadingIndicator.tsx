import { LoaderCircle } from "lucide-react";

export default function LoadingIndicator({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`loading-indicator${compact ? " is-compact" : ""}`}
      role="status"
      aria-label={label}
    >
      <LoaderCircle size={compact ? 20 : 28} aria-hidden="true" />
    </div>
  );
}
