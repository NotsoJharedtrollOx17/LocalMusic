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
    >
      <span
        className="section-indicator"
        aria-hidden="true"
        style={{
          width: motion.indicator.width,
          transform: "translateX(" + motion.indicator.x + "px)",
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
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const i = librarySections.indexOf(x),
                next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : (i + (e.key === "ArrowRight" ? 1 : -1) + 4) % 4;
              motion.tabs.current
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }
          }}
          onClick={() => {
            motion.choose(x);
          }}
        >
          {t[x]}
        </button>
      ))}
    </div>
  );
}
