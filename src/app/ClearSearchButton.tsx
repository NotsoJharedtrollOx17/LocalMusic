import { X } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
export default function ClearSearchButton() {
  const { inlineSearch, t } = useMusicAppContext();
  if (!inlineSearch.active) return null;
  return (
    <button
      type="button"
      className="icon-button search-clear"
      data-search-clear
      aria-label={t.clearSearch}
      disabled={inlineSearch.resetPhase === "out"}
      onClick={inlineSearch.clear}
    >
      <X size={20} />
    </button>
  );
}
