import { useState } from "react";
import { api } from "../api";
import { Cover, time } from "../components";
import { leadArtist, normalized } from "../library/identity";
import type {
  OrganizationSnapshot,
  OrganizationAction,
} from "../library/identity";
import type { LibraryStrings } from "../library/strings";
import { useOrganizationReview } from "./useOrganizationReview";
export default function SongOrganization({
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
  const { phone, reviewing, openReview, closeReview, clearReview, review } =
    useOrganizationReview();
  const [ids, setIds] = useState<string[]>([]),
    [preferred, setPreferred] = useState(""),
    [error, setError] = useState(""),
    [page, setPage] = useState(40);
  const select = (next: string[]) => {
    setIds(next);
    setPreferred(next[0] ?? "");
    if (!next.length) clearReview();
  };
  const selected = snapshot.tracks.filter((t) => ids.includes(t.id)),
    terms = normalized(query).split(" ").filter(Boolean),
    pool = snapshot.tracks.filter((t) =>
      terms.every((x) =>
        normalized(
          `${t.title} ${t.artist} ${t.album} ${leadArtist(t)}`,
        ).includes(x),
      ),
    );
  const audition = async (id: string) => {
    try {
      await api.play([id], 0);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <div
      className={
        "organization-workflow" + (phone && reviewing ? " is-reviewing" : "")
      }
    >
      <p className="small-muted">{text.songHint}</p>
      {error && <p role="alert">{error}</p>}
      <div className="organization-browse">
        <h3>{text.candidates}</h3>
        {snapshot.songCandidates.length === 0 ? (
          <p>{text.none}</p>
        ) : (
          snapshot.songCandidates.slice(0, 30).map((c) => (
            <div className="organization-candidate" key={c.signature}>
              <button
                className="button secondary"
                onClick={() => {
                  select(c.ids);
                  openReview();
                }}
              >
                {c.ids
                  .map((id) => {
                    const t = snapshot.tracks.find((t) => t.id === id);
                    return `${t?.title} · ${t?.album}`;
                  })
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
      </div>
      {selected.length > 0 && (!phone || reviewing) && (
        <section className="organization-review" ref={review}>
          {phone && (
            <button className="text-button" onClick={closeReview}>
              {text.back}
            </button>
          )}
          <h3>
            {text.selected} ({selected.length})
          </h3>
          {selected.map((t) => (
            <article className="organization-track" key={t.id}>
              <Cover track={t} />
              <div>
                <strong>{t.title}</strong>
                <p>{t.artist}</p>
                <small>
                  {t.album} · {time(t.durationMs)}
                </small>
              </div>
              <button
                className="button secondary"
                disabled={!t.available}
                onClick={() => void audition(t.id)}
              >
                {text.play}
              </button>
            </article>
          ))}
          <label>
            {text.preferred}
            <select
              aria-label={text.preferred}
              value={preferred}
              onChange={(e) => setPreferred(e.target.value)}
            >
              {selected.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.album}
                </option>
              ))}
            </select>
          </label>
          <div className="organization-actions">
            <button
              className="button primary"
              disabled={selected.length < 2}
              onClick={() => void change({ op: "songLink", ids, preferred })}
            >
              {text.linkSongs}
            </button>
            <button className="button secondary" onClick={() => select([])}>
              {text.clear}
            </button>
          </div>
        </section>
      )}
      <div className="organization-browse">
        <h3>
          {text.songs} ({pool.length})
        </h3>
        {pool.slice(0, page).map((t) => (
          <label
            className="organization-choice"
            data-track-id={t.id}
            key={t.id}
          >
            <input
              type="checkbox"
              checked={ids.includes(t.id)}
              onChange={() =>
                select(
                  ids.includes(t.id)
                    ? ids.filter((id) => id !== t.id)
                    : [...ids, t.id],
                )
              }
            />
            <span>
              <strong>{t.title}</strong>
              <small>
                {t.artist} · {t.album} · {time(t.durationMs)}
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
        {snapshot.state.songs.map((g) => (
          <div className="organization-linked" key={g.id}>
            <p>
              {g.ids
                .map(
                  (id) => snapshot.tracks.find((t) => t.id === id)?.title ?? id,
                )
                .join(" / ")}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setIds(g.ids);
                setPreferred(g.preferred);
                openReview();
              }}
            >
              {text.preferred}
            </button>
            <button
              className="button secondary"
              onClick={() => void change({ op: "songUnlink", id: g.id })}
            >
              {text.unlink}
            </button>
          </div>
        ))}
      </div>
      {phone && selected.length > 0 && !reviewing && (
        <div className="organization-selection">
          <strong>
            {selected.length} {text.selected.toLowerCase()}
          </strong>
          <button
            className="button primary"
            data-review-selection
            onClick={openReview}
          >
            {text.review}
          </button>
        </div>
      )}
    </div>
  );
}
