import { Music2, Shield } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryBrand() {
  const { settings, closeGroup, motion, setSelectionMode, setSelectedIds, t } =
    useMusicAppContext();
  return (
    <header className="library-brand-header">
      <a
        href="#"
        className="brand"
        onClick={(event) => {
          event.preventDefault();
          closeGroup();
          setSelectionMode(false);
          setSelectedIds([]);
          motion.choose("songs");
        }}
        aria-label={t.library}
      >
        <span className="brand-mark">
          <Music2 size={22} />
        </span>
        <span>
          local<span className="brand-period">.</span>
        </span>
      </a>
      <div className="library-brand-note">
        <span className="local-note">
          <Shield size={16} aria-hidden="true" />
          {settings?.language === "es"
            ? "Solo en tu dispositivo"
            : "Yours, on your device"}
        </span>
        {!native && (
          <span className="preview-note" title={t.previewHint}>
            {t.preview}
          </span>
        )}
      </div>
    </header>
  );
}
