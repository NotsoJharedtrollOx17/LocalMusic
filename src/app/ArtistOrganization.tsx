import { useState } from "react";
import { leadArtist, normalized } from "../library/identity";
import type {
  OrganizationSnapshot,
  OrganizationAction,
} from "../library/identity";
import type { LibraryStrings } from "../library/strings";
import ArtistOrganizationRow from "./ArtistOrganizationRow";
import { usePhoneLayout } from "../ux/usePhoneLayout";
export default function ArtistOrganization({
  snapshot,
  query,
  text,
  change,
  initialId,
}: {
  snapshot: OrganizationSnapshot;
  query: string;
  text: LibraryStrings;
  change: (a: OrganizationAction) => Promise<void>;
  initialId?: string;
}) {
  const [page, setPage] = useState(40);
  const phone = usePhoneLayout(),
    [editingId, setEditingId] = useState(initialId ?? "");
  const terms = normalized(query).split(" ").filter(Boolean),
    tracks = [...snapshot.tracks]
      .sort(
        (a, b) =>
          Number(b.id === initialId) - Number(a.id === initialId) ||
          leadArtist(a).localeCompare(leadArtist(b)) ||
          a.title.localeCompare(b.title),
      )
      .filter((t) =>
        terms.every((x) =>
          normalized(`${t.title} ${t.artist} ${leadArtist(t)}`).includes(x),
        ),
      );
  return (
    <div>
      <p className="small-muted">
        {tracks.length} {text.songs.toLowerCase()}
      </p>
      {tracks.slice(0, page).map((t) => (
        <ArtistOrganizationRow
          key={t.id}
          track={t}
          text={text}
          change={change}
          corrected={snapshot.state.artists[t.id] !== undefined}
          editing={!phone || editingId === t.id}
          onEdit={() => setEditingId(t.id)}
          onCancel={() => setEditingId("")}
        />
      ))}
      {tracks.length > page && (
        <button
          className="button secondary"
          onClick={() => setPage((n) => n + 40)}
        >
          {text.loadMore}
        </button>
      )}
      {tracks.length === 0 && <p>{text.empty}</p>}
    </div>
  );
}
