import { useEffect, useState } from "react";
import { api } from "../api";
import type { Playlist } from "../types";
import type { CleanupPreview } from "../library/identity";
import type { LibraryStrings } from "../library/strings";
export default function PlaylistCleanup({
  text,
  onChanged,
}: {
  text: LibraryStrings;
  onChanged: () => void;
}) {
  const [lists, setLists] = useState<Playlist[]>([]),
    [preview, setPreview] = useState<CleanupPreview | null>(null),
    [undo, setUndo] = useState<CleanupPreview | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .playlists()
      .then((p) => {
        if (active) setLists(p);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setPending(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="organization-review">
      <h3>{text.cleanup}</h3>
      {error && <p role="alert">{error}</p>}
      {lists.map((p) => (
        <div className="organization-candidate" key={p.id}>
          <strong>{p.title}</strong>
          <button
            disabled={pending}
            className="button secondary"
            onClick={() =>
              void run(async () => {
                setPreview(await api.playlistCleanup(p.id));
                setUndo(null);
              })
            }
          >
            {text.preview}
          </button>
        </div>
      ))}
      {preview && (
        <div role="status">
          <p>
            {preview.playlist.title}:{" "}
            {preview.playlist.trackIds.length - preview.cleaned.trackIds.length}{" "}
            {text.removed}
          </p>
          <div className="organization-actions">
            <button
              className="button primary"
              disabled={
                pending ||
                preview.playlist.trackIds.length ===
                  preview.cleaned.trackIds.length
              }
              onClick={() =>
                void run(async () => {
                  await api.applyPlaylistCleanup(preview, false);
                  setUndo(preview);
                  setPreview(null);
                  onChanged();
                })
              }
            >
              {text.apply}
            </button>
            <button
              className="button secondary"
              onClick={() => setPreview(null)}
            >
              {text.cancel}
            </button>
          </div>
        </div>
      )}
      {undo && (
        <button
          className="button secondary"
          disabled={pending}
          onClick={() =>
            void run(async () => {
              await api.applyPlaylistCleanup(undo, true);
              setUndo(null);
              onChanged();
            })
          }
        >
          {text.undo}
        </button>
      )}
    </section>
  );
}
