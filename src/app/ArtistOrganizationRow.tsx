import { useState } from "react";
import { Cover } from "../components";
import { useRef } from "react";
import { leadArtist } from "../library/identity";
import type { Track } from "../types";
import type { OrganizationAction } from "../library/identity";
import type { LibraryStrings } from "../library/strings";
export default function ArtistOrganizationRow({
  track,
  text,
  change,
  corrected,
  editing = true,
  onEdit,
  onCancel,
}: {
  track: Track;
  text: LibraryStrings;
  change: (a: OrganizationAction) => Promise<void>;
  corrected: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(leadArtist(track));
  const row = useRef<HTMLElement>(null);
  return (
    <article className="organization-artist" ref={row}>
      <Cover track={track} />
      <div>
        <strong>{track.title}</strong>
        <p className="small-muted">
          {text.original}: {track.artist || "—"}
        </p>
        {!editing && (
          <>
            <p className="small-muted">
              {text.lead}: {leadArtist(track)}
            </p>
            <button data-artist-edit className="text-button" onClick={onEdit}>
              {text.edit}
            </button>
          </>
        )}
        {editing && (
          <>
            <label>
              {text.lead}
              <input
                value={name}
                maxLength={240}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="organization-actions">
              <button
                className="button secondary"
                disabled={!name.trim() || name.trim() === leadArtist(track)}
                onClick={() =>
                  void change({ op: "artist", ids: [track.id], name })
                }
              >
                {text.save}
              </button>
              {corrected && (
                <button
                  className="button secondary"
                  onClick={() =>
                    void change({ op: "artist", ids: [track.id], name: null })
                  }
                >
                  {text.reset}
                </button>
              )}
              {onCancel && (
                <button
                  className="button secondary organization-cancel-edit"
                  onClick={() => {
                    setName(leadArtist(track));
                    onCancel();
                    requestAnimationFrame(() =>
                      row.current
                        ?.querySelector<HTMLElement>("[data-artist-edit]")
                        ?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  {text.cancel}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
