import { useLayoutEffect } from "react";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryPage from "./LibraryPage";
import LibraryBrand from "./LibraryBrand";
import ImportStatus from "./ImportStatus";

export default function AppContent() {
  const { chooserOpen, importProgress, motion, group, selectionMode, modal } =
    useMusicAppContext();
  const canSwipe = !group && !selectionMode && !modal && !chooserOpen;
  useLayoutEffect(() => {
    motion.resetSwipe();
  }, [canSwipe, motion.resetSwipe]);

  return (
    <div
      className="content-shell"
      inert={chooserOpen}
      {...(canSwipe ? motion.swipe : {})}
    >
      <span className="library-swipe-gutter left" aria-hidden="true" />
      <span className="library-swipe-gutter right" aria-hidden="true" />
      <LibraryBrand />
      <main>
        {importProgress && <ImportStatus />}
        <LibraryPage />
      </main>
    </div>
  );
}
