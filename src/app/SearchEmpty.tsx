import { Search } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
export default function SearchEmpty() {
  const { inlineSearch, t } = useMusicAppContext();
  return (
    <div className="empty-small search-empty">
      <Search aria-hidden="true" />
      <h3>{t.noResults}</h3>
      <p>{t.searchEmpty}</p>
      <button
        type="button"
        className="button secondary"
        onClick={inlineSearch.clear}
      >
        {t.clearSearch}
      </button>
    </div>
  );
}
