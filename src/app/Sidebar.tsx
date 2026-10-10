import { Music2, Settings2, Shield } from "lucide-react";
import { native } from "../api";

import { useMusicAppContext } from "./MusicAppContext";
import MainNavigation from "./MainNavigation";

export default function Sidebar() {
  const { setTab, settings, setModal, chooserOpen, t } = useMusicAppContext();

  return (
    <aside className="sidebar" inert={chooserOpen}>
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          setTab("library");
        }}
      >
        <span className="brand-mark">
          <Music2 size={22} />
        </span>
        <span>
          local<span className="brand-period">.</span>
        </span>
      </a>
      <p className="sidebar-caption">YOUR MUSIC. YOUR YEAR.</p>
      <nav aria-label="Main navigation">
        <MainNavigation />
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <Shield size={16} />
          <span>
            {settings?.language === "es"
              ? "Solo en tu dispositivo"
              : "Yours, on your device"}
          </span>
        </div>
        <button
          className="sidebar-settings"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={18} />
          {t.settings}
        </button>
        {!native && (
          <p className="preview-note" title={t.previewHint}>
            {t.preview}
            <span>↗</span>
          </p>
        )}
      </div>
    </aside>
  );
}
