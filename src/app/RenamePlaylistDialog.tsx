import { useEffect, useRef, useState } from "react";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import type { Playlist } from "../types";

export default function RenamePlaylistDialog({
  playlist,
  onClose,
  onSave,
}: {
  playlist: Playlist;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const { t } = useMusicAppContext();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const [title, setTitle] = useState(playlist.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <Modal title={t.renamePlaylist} closeLabel={t.close} onClose={close}>
      <form
        className="rename-playlist-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving || !title.trim()) return;
          setSaving(true);
          setError("");
          void onSave(title.trim())
            .catch((reason) => setError(String(reason)))
            .finally(() => setSaving(false));
        }}
      >
        <label>
          {t.playlistName}
          <input
            ref={input}
            value={title}
            required
            maxLength={120}
            disabled={saving}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="rename-playlist-actions">
          <button
            type="button"
            className="button"
            disabled={saving}
            onClick={close}
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={saving || !title.trim()}
            aria-busy={saving}
          >
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
