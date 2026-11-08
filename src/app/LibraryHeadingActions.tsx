import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../components";
import { usePhoneLayout } from "../ux/usePhoneLayout";
import { useMusicAppContext } from "./MusicAppContext";
import SearchTriggerIcon from "./SearchTriggerIcon";
import LibraryActions from "./LibraryActions";

export default function LibraryHeadingActions() {
  const phone = usePhoneLayout();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { section, searchOpen, inlineSearch, setSearchOpen, searchInput, t } =
    useMusicAppContext();
  useLayoutEffect(() => {
    setHost(document.getElementById("library-header-actions"));
  }, []);
  const content = (
    <div className="heading-actions">
      {section !== "year" && (
        <span data-search-trigger className="search-trigger-controls">
          <IconButton
            label={t.search}
            active={inlineSearch.active}
            onClick={() =>
              searchOpen
                ? inlineSearch.close()
                : (setSearchOpen(true),
                  requestAnimationFrame(() => searchInput.current?.focus()))
            }
          >
            <SearchTriggerIcon />
          </IconButton>
        </span>
      )}
      <LibraryActions />
    </div>
  );
  return phone && host ? createPortal(content, host) : content;
}
