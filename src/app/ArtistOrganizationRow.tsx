import { useState } from "react";
import { Cover } from "../components";
import { leadArtist } from "../library/identity";
import type { Track } from "../types";
import type { OrganizationAction } from "../library/identity";
import type { LibraryStrings } from "../library/strings";
export default function ArtistOrganizationRow({
  track,
  text,
  change,
  corrected,
}: {
  track: Track;
  text: LibraryStrings;
  change: (a: OrganizationAction) => Promise<void>;
  corrected: boolean;
}) {
  const [name, setName] = useState(leadArtist(track));
  return (
    <article className="organization-artist">
      <Cover track={track} />
      <div>
        <strong>{track.title}</strong>
        <p className="small-muted">
          {text.original}: {track.artist || "—"}
        </p>
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
            onClick={() => void change({ op: "artist", ids: [track.id], name })}
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
        </div>
      </div>
    </article>
  );
}
