import InlineSearch from "./InlineSearch";
import InlineSearchStatus from "./InlineSearchStatus";
import LibraryHeadingActions from "./LibraryHeadingActions";
import LibraryTabs from "./LibraryTabs";
import { ArrowLeft } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryPaneContents from "./LibraryPaneContents";
import LibraryPager from "./LibraryPager";
import { usePhoneLayout } from "../ux/usePhoneLayout";

export default function LibraryPage() {
  const { motion, searchOpen, section, group, backGroup, inlineSearch, t } =
    useMusicAppContext();
  const phone = usePhoneLayout();
  return (
    <section
      ref={motion.bindPanel}
      style={
        {
          "--library-heading-height": motion.headingHeight + "px",
        } as React.CSSProperties
      }
      className={"library-page" + (motion.compact ? " is-compact" : "")}
    >
      <div
        className={
          "page-heading library-navigation" +
          (searchOpen && section !== "year" ? " has-inline-search" : "")
        }
      >
        {group ? (
          <button className="text-button group-back" onClick={backGroup}>
            <ArrowLeft size={17} />
            {t.library}
          </button>
        ) : (
          <LibraryTabs />
        )}
        <InlineSearch />
        <LibraryHeadingActions />
      </div>
      <InlineSearchStatus />
      {phone ? (
        <LibraryPager />
      ) : (
        <div
          id="library-content"
          data-search-reset={inlineSearch.resetPhase || undefined}
          role={!group ? "tabpanel" : undefined}
          aria-labelledby={!group ? "tab-" + section : undefined}
          aria-busy={
            inlineSearch.resetPhase === "out" ||
            (inlineSearch.active && inlineSearch.pending)
          }
          inert={
            inlineSearch.resetPhase === "out" ||
            (inlineSearch.active &&
              (inlineSearch.stale || !!inlineSearch.error))
          }
        >
          <LibraryPaneContents />
        </div>
      )}
    </section>
  );
}
