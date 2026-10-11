import { Shield } from "lucide-react";

import { useMusicAppContext } from "./MusicAppContext";
import LibraryPage from "./LibraryPage";
import LibraryBrand from "./LibraryBrand";
import ImportStatus from "./ImportStatus";

export default function AppContent() {
  const { settings, chooserOpen, importProgress } = useMusicAppContext();

  return (
    <div className="content-shell" inert={chooserOpen}>
      <LibraryBrand />
      <main>
        {importProgress && <ImportStatus />}
        <LibraryPage />
      </main>
      <footer className="page-footer">
        <span>LOCAL MUSIC / {new Date().getFullYear()}</span>
        <span>
          <Shield size={12} />
          {settings?.language === "es"
            ? "Privado por naturaleza"
            : "Private by nature"}
        </span>
      </footer>
    </div>
  );
}
