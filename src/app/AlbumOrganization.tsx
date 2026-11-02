import { useMemo, useState } from "react";
import { Cover, time } from "../components";
import {
  sourceAlbums,
  albumArtist,
  normalized,
  candidateSong,
  songIdentity,
} from "../library/identity";
import type {
  OrganizationSnapshot,
  OrganizationAction,
} from "../library/identity";
import type { LibraryStrings } from "../library/strings";
export default function AlbumOrganization({
  snapshot,
  query,
  text,
  change,
}: {
  snapshot: OrganizationSnapshot;
  query: string;
  text: LibraryStrings;
  change: (a: OrganizationAction) => Promise<void>;
}) {
  const albums = useMemo(() => [...sourceAlbums(snapshot.tracks)], [snapshot]),
    [keys, setKeys] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [artist, setArtist] = useState(""),
    [coverId, setCoverId] = useState(""),
    [page, setPage] = useState(40);
  const select = (next: string[]) => {
    setKeys(next);
    const first = albums.find(([key]) => next.includes(key))?.[1][0];
    setTitle(first?.album ?? "");
    setArtist(first ? albumArtist(first) : "");
    setCoverId(first?.id ?? "");
  };
  const selected = albums.filter(([key]) => keys.includes(key)),
    tracks = selected.flatMap(([, ts]) => ts),
    cover = tracks.find((t) => t.id === coverId),
    terms = normalized(query).split(" ").filter(Boolean),
    pool = albums.filter(([, ts]) =>
      terms.every((x) =>
        normalized(
          `${ts[0].album} ${albumArtist(ts[0])} ${ts[0].albumIdentity?.title ?? ""}`,
        ).includes(x),
      ),
    );
  return (
    <div>
      <p className="small-muted">{text.albumHint}</p>
      <h3>{text.candidates}</h3>
      {snapshot.albumCandidates.length === 0 ? (
        <p>{text.none}</p>
      ) : (
        snapshot.albumCandidates.slice(0, 30).map((c) => (
          <div className="organization-candidate" key={c.signature}>
            <button className="button secondary" onClick={() => select(c.ids)}>
              {c.ids
                .map((id) => albums.find(([k]) => k === id)?.[1][0].album)
                .join(" / ")}
            </button>
            <button
              className="button secondary"
              onClick={() =>
                void change({ op: "dismiss", signature: c.signature })
              }
            >
              {text.keep}
            </button>
          </div>
        ))
      )}
      {keys.length > 0 && (
        <section className="organization-review">
          <h3>
            {text.selected} ({selected.length})
          </h3>
          <div className="organization-albums">
            {selected.map(([key, ts]) => (
              <article key={key}>
                <Cover track={ts[0]} large />
                <h4>{ts[0].album}</h4>
                <p>
                  {albumArtist(ts[0])} · {ts[0].releaseYear ?? "—"} ·{" "}
                  {ts.length} {text.songs.toLowerCase()}
                </p>
                <ol>
                  {ts.map((t) => {
                    const other = selected
                        .filter(([k]) => k !== key)
                        .flatMap(([, tracks]) => tracks),
                      matches = other.some(
                        (u) =>
                          songIdentity(t) === songIdentity(u) ||
                          candidateSong(t, u),
                      );
                    return (
                      <li key={t.id}>
                        <strong>{t.title}</strong>
                        <small>
                          {time(t.durationMs)} ·{" "}
                          {matches ? text.matched : text.unmatched}
                        </small>
                      </li>
                    );
                  })}
                </ol>
              </article>
            ))}
          </div>
          <label>
            {text.albumName}
            <input
              maxLength={240}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {text.albumArtist}
            <input
              maxLength={240}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </label>
          <label>
            {text.cover}
            <select
              value={coverId}
              onChange={(e) => setCoverId(e.target.value)}
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.album} · {t.title}
                </option>
              ))}
            </select>
          </label>
          {cover && <Cover track={cover} />}
          <div className="organization-actions">
            <button
              className="button primary"
              disabled={!title.trim() || !artist.trim() || !coverId}
              onClick={() =>
                void change({ op: "albumLink", keys, title, artist, coverId })
              }
            >
              {text.linkAlbums}
            </button>
            <button className="button secondary" onClick={() => select([])}>
              {text.clear}
            </button>
          </div>
        </section>
      )}
      <h3>
        {text.albums} ({pool.length})
      </h3>
      {pool.slice(0, page).map(([key, ts]) => (
        <label className="organization-choice" key={key}>
          <input
            type="checkbox"
            checked={keys.includes(key)}
            onChange={() =>
              select(
                keys.includes(key)
                  ? keys.filter((k) => k !== key)
                  : [...keys, key],
              )
            }
          />
          <Cover track={ts[0]} />
          <span>
            <strong>{ts[0].album}</strong>
            <small>
              {albumArtist(ts[0])} · {ts[0].releaseYear ?? "—"} · {ts.length}{" "}
              {text.songs.toLowerCase()}
            </small>
          </span>
        </label>
      ))}
      {pool.length > page && (
        <button
          className="button secondary"
          onClick={() => setPage((n) => n + 40)}
        >
          +40
        </button>
      )}
      <h3>{text.linked}</h3>
      {snapshot.state.albums.map((g) => (
        <div className="organization-linked" key={g.id}>
          <p>
            <strong>{g.title}</strong> · {g.artist}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setKeys(g.keys);
              setTitle(g.title);
              setArtist(g.artist);
              setCoverId(g.coverId);
            }}
          >
            {text.edit}
          </button>
          <button
            className="button secondary"
            onClick={() => void change({ op: "albumUnlink", id: g.id })}
          >
            {text.unlink}
          </button>
        </div>
      ))}
    </div>
  );
}
