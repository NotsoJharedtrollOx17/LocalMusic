import { librarySections } from "../ux";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryTabs() {
  const { section, motion, t } = useMusicAppContext();

  return (
    <div
      ref={motion.bindTabs}
      className="section-tabs"
      role="tablist"
      aria-label={t.library}
      {...motion.strip}
    >
      <span
        className="section-indicator"
        aria-hidden="true"
        style={{
          width: `var(--drag-tab-width, ${motion.indicator.width}px)`,
          transform: `translateX(var(--drag-tab-x, ${motion.indicator.x}px))`,
        }}
      />
      {librarySections.map((x) => (
        <button
          key={x}
          role="tab"
          aria-selected={section === x}
          tabIndex={section === x ? 0 : -1}
          id={"tab-" + x}
          aria-controls="library-content"
          onFocus={(e) => {
            if (document.documentElement.dataset.input === "keyboard")
              motion.revealTab(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const i = librarySections.indexOf(x),
                next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? librarySections.length - 1
                      : (i +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          librarySections.length) %
                        librarySections.length;
              motion.tabs.current
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus({ preventScroll: true });
            }
          }}
          onClick={() => {
            motion.choose(x);
          }}
        >
          <span className="tab-caption" data-label={t[x]}>
            {t[x]}
          </span>
        </button>
      ))}
    </div>
  );
}
