import {
  X,
  Circle,
  Play,
  ListPlus,
  Heart,
  Share2,
  Trash2,
  LoaderCircle,
} from "lucide-react";
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
  const actions = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = actions.current,
      shell = node?.closest<HTMLElement>(".content-shell");
    if (!node || !shell) return;
    const layout = document.documentElement;
    const content = node.closest<HTMLElement>("#library-content");
    content?.getAnimations().forEach((animation) => animation.cancel());
    if (content) content.style.transform = "";
    const toolbar = node.closest<HTMLElement>(".selection-toolbar");
    const measure = () => {
      layout.style.setProperty(
        "--selection-actions-height",
        `${node.getBoundingClientRect().height}px`,
      );
      if (toolbar)
        layout.style.setProperty(
          "--selection-head-height",
          `${toolbar.getBoundingClientRect().height}px`,
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (toolbar) observer.observe(toolbar);
    return () => {
      observer.disconnect();
      layout.style.removeProperty("--selection-actions-height");
      layout.style.removeProperty("--selection-head-height");
    };
  }, []);
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
          {selecting ? (
            <LoaderCircle
              className="selection-action-icon selection-busy"
              size={18}
              aria-hidden="true"
            />
          ) : (
            <Circle
              className="selection-action-icon"
              size={18}
              aria-hidden="true"
            />
          )}
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
      <div className="selection-actions" ref={actions}>
        <button
          className="text-button"
          disabled={!selectedIds.length}
          onClick={() => void act(() => api.play(selectedIds))}
        >
          <Play
            className="selection-action-icon"
            size={20}
            aria-hidden="true"
          />
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
          <ListPlus
            className="selection-action-icon"
            size={20}
            aria-hidden="true"
          />
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
          <Heart
            className="selection-action-icon"
            size={20}
            aria-hidden="true"
          />
          {t.favorite}
        </button>
        <button
          className="text-button"
          disabled={!selectedIds.length || sharing}
          onClick={() => void share(selectedIds)}
        >
          <Share2
            className="selection-action-icon"
            size={20}
            aria-hidden="true"
          />
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
          <Trash2
            className="selection-action-icon"
            size={20}
            aria-hidden="true"
          />
          {t.removeLibrary}
        </button>
      </div>
    </div>
  );
}
