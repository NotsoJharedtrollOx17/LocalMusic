import { Music2, ArrowUpRight, FolderOpen, Upload } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function EmptyLibrary() {
  const { busy, fileInput, folderInput, t, doImport, samples } =
    useMusicAppContext();

  return (
    <div className="empty-library">
      <div className="empty-art">
        <span />
        <span />
        <span />
        <Music2 size={28} />
      </div>
      <p className="eyebrow">A COLLECTION THAT IS YOURS</p>
      <h2>{t.emptyTitle}</h2>
      <p>{t.emptyBody}</p>
      <div className="empty-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            native ? void doImport() : fileInput.current?.click()
          }
        >
          <Upload size={18} />
          {t.import}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            native
              ? void doImport(undefined, "folder")
              : folderInput.current?.click()
          }
        >
          <FolderOpen size={18} />
          {t.importFolder}
        </button>
      </div>
      <small>{t.emptyHint}</small>
      {!native && (
        <button
          className="text-button sample-link"
          disabled={busy}
          onClick={() => void samples()}
        >
          {t.sample}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
