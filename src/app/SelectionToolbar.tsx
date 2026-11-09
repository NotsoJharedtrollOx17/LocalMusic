import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import { IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SelectionToolbar() {
  const {
    query,
    setNotice,
    setModal,
    setCatalogRevision,
    selectedIds,
    setSelectedIds,
    setSelectionMode,
    setActionIds,
    t,
    act,
    remember,
    refresh,
    share,
    shareLabel,
    sharing,
    section,
    selectedList,
    group,
    sort,
    onlyFavorites,
    inlineSearch,
    catalogRevision,
    recap,
  } = useMusicAppContext();
  const request = useRef(0),
    [selecting, setSelecting] = useState(false);
  const scope = JSON.stringify([
    section,
    group?.id,
    group?.title,
    selectedList?.id,
    selectedList?.trackIds,
    query,
    sort,
    onlyFavorites,
    catalogRevision,
  ]);
  useLayoutEffect(() => {
    ++request.current;
    setSelecting(false);
    return () => {
      ++request.current;
    };
  }, [scope]);
  const selectAll = () => {
    if (selecting || inlineSearch.pending) return;
    const token = ++request.current;
    setSelecting(true);
    void act(async () => {
      try {
        const members =
          selectedList?.trackIds ??
          group?.ids ??
          (section === "year"
            ? recap?.topTracks.slice(0, 10).map((x) => x.track.id)
            : undefined);
        let ids: string[] = [];
        if (members)
          ids = await api.filterTrackIds(
            members,
            inlineSearch.active ? query : "",
          );
        else {
          for (let offset = 0; token === request.current;) {
            const page = await api.listTracks(
              inlineSearch.active ? query : "",
              offset,
              200,
              { sort, favoriteOnly: onlyFavorites },
            );
            ids.push(...page.tracks.map((track) => track.id));
            offset += page.tracks.length;
            if (!page.tracks.length || offset >= page.total) break;
          }
        }
        if (token === request.current) setSelectedIds([...new Set(ids)]);
      } finally {
        if (token === request.current) setSelecting(false);
      }
    });
  };

  return (
    <div className="selection-toolbar" role="region" aria-label={t.selectSongs}>
      <div className="selection-heading">
        <strong aria-live="polite" aria-atomic="true">
          {selectedIds.length} {t.selected}
        </strong>
        <button
          className="text-button"
          disabled={selecting || inlineSearch.pending}
          aria-busy={selecting}
          onClick={selectAll}
        >
          {t.selectAll}
        </button>
        <IconButton
          label={t.close}
          onClick={() => {
            setSelectionMode(false);
            setSelectedIds([]);
          }}
        >
          <X />
        </IconButton>
      </div>
      <div className="selection-actions">
        <button
          className="text-button"
          disabled={!selectedIds.length}
          onClick={() => void act(() => api.play(selectedIds))}
        >
          {t.play}
        </button>
        <button
          className="text-button"
          disabled={!selectedIds.length}
          onClick={() => {
            setActionIds(selectedIds);
            setModal("add");
          }}
        >
          {t.addToPlaylist}
        </button>
        <button
          className="text-button"
          disabled={!selectedIds.length}
          onClick={() =>
            void act(async () => {
              for (const id of selectedIds) await api.setFavorite(id, true);
              remember(await api.tracksById(selectedIds));
              await refresh(query);
              setCatalogRevision((v) => v + 1);
              setNotice(t.done);
            })
          }
        >
          {t.favorite}
        </button>
        <button
          className="text-button"
          disabled={!selectedIds.length || sharing}
          onClick={() => void share(selectedIds)}
        >
          {shareLabel}
        </button>
        <button
          className="text-button"
          disabled={!selectedIds.length}
          onClick={() => {
            setActionIds(selectedIds);
            setModal("remove");
          }}
        >
          {t.removeLibrary}
        </button>
      </div>
    </div>
  );
}
