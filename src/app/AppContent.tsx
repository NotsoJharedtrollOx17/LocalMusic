import { useLibraryPresentation } from "./useLibraryPresentation";
import { memo, useLayoutEffect } from "react";
import { MusicAppContext, useMusicAppContext } from "./MusicAppContext";
import LibraryPage from "./LibraryPage";
import LibraryBrand from "./LibraryBrand";
import ImportStatus from "./ImportStatus";

export default function AppContent() {
  const presentation = useLibraryPresentation(useMusicAppContext());
  return (
    <MusicAppContext.Provider value={presentation}>
      <StableLibraryContent />
    </MusicAppContext.Provider>
  );
}
const StableLibraryContent = memo(function StableLibraryContent() {
  const {
    chooserOpen,
    importProgress,
    motion,
    group,
    selectedList,
    editingList,
    selectionMode,
    modal,
  } = useMusicAppContext();
  const canSwipe =
    !group &&
    !selectedList &&
    !editingList &&
    !selectionMode &&
    !modal &&
    !chooserOpen;
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
});
