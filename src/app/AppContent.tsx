import { useMusicAppContext } from "./MusicAppContext";
import LibraryPage from "./LibraryPage";
import LibraryBrand from "./LibraryBrand";
import ImportStatus from "./ImportStatus";

export default function AppContent() {
  const { chooserOpen, importProgress } = useMusicAppContext();

  return (
    <div className="content-shell" inert={chooserOpen}>
      <LibraryBrand />
      <main>
        {importProgress && <ImportStatus />}
        <LibraryPage />
      </main>
    </div>
  );
}
