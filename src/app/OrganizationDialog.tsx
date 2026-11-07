import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api";
import { Modal } from "../components";
import LoadingIndicator from "../components/LoadingIndicator";
import { usePlayerContext } from "./PlayerContext";
import { libraryStrings } from "../library/strings";
import type {
  OrganizationSnapshot,
  OrganizationAction,
} from "../library/identity";
import ArtistOrganization from "./ArtistOrganization";
import SongOrganization from "./SongOrganization";
import AlbumOrganization from "./AlbumOrganization";
import PlaylistCleanup from "./PlaylistCleanup";
import "../library/organization.css";
import { useInteractionScope } from "../ux/useInteractionScope";
export default function OrganizationDialog() {
  const {
      modal,
      setModal,
      settings,
      organizationTab,
      setOrganizationTab,
      detail,
      setError: reportError,
    } = usePlayerContext(),
    open = modal === "organize",
    text = libraryStrings(settings?.language === "es");
  const capture = useInteractionScope(modal);
  const [snapshot, setSnapshot] = useState<OrganizationSnapshot | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState("");
  const request = useRef(0),
    active = useRef(open);
  active.current = open;
  const load = useCallback(async () => {
    const token = ++request.current;
    setPending(true);
    setError("");
    try {
      const data = await api.organization();
      if (active.current && token === request.current) setSnapshot(data);
    } catch (e) {
      if (active.current && token === request.current)
        setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (active.current && token === request.current) setPending(false);
    }
  }, []);
  useEffect(() => {
    if (open) {
      setSnapshot(null);
      setQuery("");
      setNotice("");
      void load();
    } else {
      request.current++;
      setPending(false);
    }
    return () => {
      request.current++;
    };
  }, [open, load]);
  const change = async (action: OrganizationAction) => {
    if (!snapshot || pending) return;
    setPending(true);
    setError("");
    const current = capture();
    try {
      await api.organize(snapshot.state.revision, action);
      window.dispatchEvent(new Event("library-organization-changed"));
      if (!current()) return;
      setNotice(text.done);
      await load();
    } catch (e) {
      if (!current()) {
        reportError(String(e instanceof Error ? e.message : e));
        return;
      }
      setPending(false);
      setError(String(e instanceof Error ? e.message : e));
    }
  };
  if (!open) return null;
  return (
    <Modal
      title={text.organize}
      closeLabel={text.close}
      onClose={() => {
        setModal(null);
        requestAnimationFrame(() => {
          const origin = Array.from(
            document.querySelectorAll<HTMLElement>(
              "[data-organization-origin]",
            ),
          ).find((el) => el.getClientRects().length && !el.closest("[inert]"));
          origin?.focus({ preventScroll: true });
        });
      }}
      wide
    >
      <div className="organization" aria-busy={pending}>
        <p className="small-muted">{text.hint}</p>
        <div
          className="organization-tabs"
          role="group"
          aria-label={text.organize}
        >
          {(["artists", "songs", "albums"] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              aria-pressed={tab === organizationTab}
              onClick={() => {
                setOrganizationTab(tab);
                setQuery("");
                setNotice("");
              }}
            >
              {text[tab]}
            </button>
          ))}
        </div>
        <label className="organization-search">
          {text.search}
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={() => void load()}>
              {text.retry}
            </button>
          </div>
        )}
        <p role="status" className="small-muted">
          {notice}
        </p>
        {!snapshot ? (
          <LoadingIndicator label={text.loading} />
        ) : (
          <fieldset disabled={pending} className="organization-body">
            {organizationTab === "artists" ? (
              <ArtistOrganization
                key={snapshot.state.revision}
                snapshot={snapshot}
                query={query}
                text={text}
                change={change}
                initialId={detail?.id}
              />
            ) : organizationTab === "songs" ? (
              <SongOrganization
                key={snapshot.state.revision}
                snapshot={snapshot}
                query={query}
                text={text}
                change={change}
              />
            ) : (
              <AlbumOrganization
                key={snapshot.state.revision}
                snapshot={snapshot}
                query={query}
                text={text}
                change={change}
              />
            )}
            {organizationTab === "songs" && (
              <PlaylistCleanup
                text={text}
                onChanged={() =>
                  window.dispatchEvent(
                    new Event("library-organization-changed"),
                  )
                }
              />
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
