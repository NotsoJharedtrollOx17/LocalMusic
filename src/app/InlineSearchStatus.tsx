import { useMusicAppContext } from "./MusicAppContext";

export default function InlineSearchStatus() {
  const { searchOpen, section, inlineSearch, settings, t } =
    useMusicAppContext();
  if ((!searchOpen && !inlineSearch.active) || section === "year") return null;
  const page = inlineSearch.page;
  return (
    <div
      className="inline-search-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {inlineSearch.error ? (
        <>
          <span>{t.searchFailed}</span>
          <button
            type="button"
            className="text-button"
            onClick={inlineSearch.retry}
          >
            {t.retry}
          </button>
        </>
      ) : !inlineSearch.pending && inlineSearch.active && page ? (
        <span className="search-announcement">
          {t.searchCount
            .replace("{count}", page.total.toLocaleString(settings?.language))
            .replace(
              "{total}",
              page.allTotal.toLocaleString(settings?.language),
            )}
        </span>
      ) : null}
    </div>
  );
}
