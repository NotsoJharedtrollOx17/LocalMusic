import { api } from "../api";
import { compareCatalogTracks } from "../domain";
import { matchesSearch, searchRank } from "../search/match";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MusicAppContext,
  useMusicAppContext,
  type MusicAppModel,
} from "./MusicAppContext";
import LibraryPaneContents from "./LibraryPaneContents";
import {
  LibraryScrollContext,
  LibraryScrollOffsetContext,
} from "../ux/libraryScroll";
import { librarySections, type LibrarySection } from "../ux/useLibraryMotion";
import { useContentPager } from "../ux/useContentPager";

const positions = new Map<string, number>();
const anchors = new Map<string, { key: string; offset: number }>();

function Pane({
  kind,
  position,
  active,
  model,
}: {
  kind: LibrarySection;
  position: number;
  active: boolean;
  model: MusicAppModel;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const key = JSON.stringify([
    kind,
    active ? model.group?.id : null,
    active ? model.selectedList?.id : null,
  ]);
  const previous = useRef(key);
  useLayoutEffect(() => {
    if (!root || !active) return;
    const save = () => {
      positions.set(key, root.scrollTop);
      const top = root.getBoundingClientRect().top;
      const row = [
        ...root.querySelectorAll<HTMLElement>("[data-library-key]"),
      ].find((el) => el.getBoundingClientRect().bottom > top + 1);
      if (row)
        anchors.set(key, {
          key: row.dataset.libraryKey!,
          offset: row.getBoundingClientRect().top - top,
        });
      else anchors.delete(key);
      while (positions.size > 256) {
        const oldest = positions.keys().next().value!;
        positions.delete(oldest);
        anchors.delete(oldest);
      }
    };
    document.addEventListener("library-save-scroll", save);
    return () => document.removeEventListener("library-save-scroll", save);
  }, [root, key, active]);
  useLayoutEffect(() => {
    if (!root) return;
    root.scrollTop = positions.get(key) ?? 0;
    previous.current = key;
    if (!active) return;
    const anchor = anchors.get(key);
    let attempts = 0,
      frame = 0;
    const restore = () => {
      if (!anchor) return;
      const node = root.querySelector<HTMLElement>(
        `[data-library-key="${CSS.escape(anchor.key)}"]`,
      );
      if (node)
        root.scrollTop +=
          node.getBoundingClientRect().top -
          root.getBoundingClientRect().top -
          anchor.offset;
      if (++attempts < 6) frame = requestAnimationFrame(restore);
    };
    const cancel = () => {
      cancelAnimationFrame(frame);
      attempts = 6;
    };
    root.addEventListener("pointerdown", cancel, { once: true, capture: true });
    root.addEventListener("wheel", cancel, { once: true, passive: true });
    restore();
    return () => {
      cancel();
      root.removeEventListener("pointerdown", cancel, true);
      root.removeEventListener("wheel", cancel);
    };
  }, [root, key, active]);
  const filter = JSON.stringify([
    model.query.trim(),
    kind === "songs" ? model.onlyFavorites : false,
    model.sort,
  ]);
  const lastFilter = useRef({ key, filter });
  useLayoutEffect(() => {
    if (
      active &&
      lastFilter.current.key === key &&
      lastFilter.current.filter !== filter &&
      root
    ) {
      root.scrollTop = 0;
      positions.set(key, 0);
      anchors.delete(key);
    }
    if (active) lastFilter.current = { key, filter };
  }, [filter, root, key, active]);
  return (
    <div
      ref={setRoot}
      className="library-pane"
      data-pane={kind}
      data-active={active}
      style={{ transform: `translateX(${position * 100}%)` }}
      inert={!active}
      aria-hidden={!active || undefined}
      role={active && !model.group ? "tabpanel" : undefined}
      aria-labelledby={active && !model.group ? "tab-" + kind : undefined}
      onScroll={(e) => {
        positions.set(previous.current, e.currentTarget.scrollTop);
      }}
    >
      {root && (
        <LibraryScrollContext.Provider value={root}>
          <LibraryScrollOffsetContext.Provider value={positions.get(key) ?? 0}>
            <MusicAppContext.Provider value={model}>
              <div
                id={active ? "library-content" : undefined}
                className="library-pane-content"
                data-search-reset={
                  active
                    ? model.inlineSearch.resetPhase || undefined
                    : undefined
                }
                aria-busy={
                  active &&
                  model.inlineSearch.active &&
                  model.inlineSearch.pending
                }
                inert={
                  active &&
                  (model.inlineSearch.resetPhase === "out" ||
                    (model.inlineSearch.active &&
                      (model.inlineSearch.stale || !!model.inlineSearch.error)))
                }
              >
                <LibraryPaneContents />
              </div>
            </MusicAppContext.Provider>
          </LibraryScrollOffsetContext.Provider>
        </LibraryScrollContext.Provider>
      )}
    </div>
  );
}

export default function LibraryPager() {
  const model = useMusicAppContext();
  const {
    section,
    motion,
    group,
    selectedList,
    selectionMode,
    editingList,
    modal,
    chooserOpen,
  } = model;
  const enabled =
    !group &&
    !selectedList &&
    !selectionMode &&
    !editingList &&
    !modal &&
    !chooserOpen;
  const pager = useContentPager(
    section,
    (next) => {
      document.dispatchEvent(new Event("library-save-scroll"));
      motion.commit(next);
    },
    enabled,
  );
  useLayoutEffect(() => {
    motion.contentPager.current = pager.controller;
    return () => {
      motion.contentPager.current = null;
    };
  });
  const recapStamp = useRef({
    recap: model.recap,
    revision: model.catalogRevision,
  });
  if (recapStamp.current.recap !== model.recap)
    recapStamp.current = {
      recap: model.recap,
      revision: model.catalogRevision,
    };
  const [matches, setMatches] = useState<{
    key: string;
    songs: import("../types").Track[];
    albums: import("../types").CatalogGroup[];
    artists: import("../types").CatalogGroup[];
  } | null>(null);
  const matchKey = JSON.stringify([
    model.query.trim(),
    model.catalogIndex?.revision,
    model.onlyFavorites,
    model.sort,
  ]);
  useEffect(() => {
    const index = model.catalogIndex,
      q = model.query;
    if (!index || !q.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all([
        api.filterTrackIds(
          index.tracks.map((t) => t.id),
          q,
        ),
        api.groups("albums", 0, q, 1_000_000),
        api.groups("artists", 0, q, 1_000_000),
      ])
        .then(([ids, albums, artists]) => {
          if (!live) return;
          const byId = new Map(index.tracks.map((t) => [t.id, t]));
          const gs = (groups: typeof albums.groups) =>
            groups.map((g) => ({
              ...g,
              track: byId.get(g.track.id) ?? g.track,
            }));
          setMatches({
            key: matchKey,
            songs: ids
              .map((id) => byId.get(id)!)
              .filter((t) => t && (!model.onlyFavorites || t.favorite))
              .sort(
                (a, b) =>
                  searchRank(a.title, q) - searchRank(b.title, q) ||
                  compareCatalogTracks(a, b, model.sort),
              ),
            albums: gs(albums.groups),
            artists: gs(artists.groups),
          });
        })
        .catch(() => {
          /* Active search owns its visible Retry state. */
        });
    }, 160);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [matchKey]);
  const preview = (kind: LibrarySection): MusicAppModel => {
    const index = model.catalogIndex;
    const groups = kind === "artists" ? index?.artists : index?.albums;
    const safeRecap =
      (model.recap?.privacyRevision ?? 0) ===
        (model.settings?.privacyRevision ?? 0) &&
      recapStamp.current.revision === model.catalogRevision;
    const searching = kind !== "year" && !!model.query.trim();
    const matched = matches?.key === matchKey ? matches : null;
    const lists = model.lists.filter(
      (p) => !searching || matchesSearch(p.title, model.query),
    );
    const automatic = model.automatic.playlists.filter(
      (p) =>
        !searching ||
        matchesSearch(automaticPlaylistLabel(p, model.t), model.query),
    );
    const foundGroups = kind === "artists" ? matched?.artists : matched?.albums;
    const foundTracks = matched?.songs ?? [];
    const result = searching
      ? {
          key: matchKey,
          view: kind === "songs" ? "tracks" : kind,
          tracks: foundTracks,
          groups: foundGroups ?? [],
          ids: foundTracks.map((t) => t.id),
          lists,
          automatic,
          total:
            kind === "playlists"
              ? lists.length + automatic.length
              : kind === "songs"
                ? foundTracks.length
                : (foundGroups?.length ?? 0),
          allTotal:
            kind === "playlists"
              ? model.lists.length + model.automatic.playlists.length
              : kind === "songs"
                ? (index?.tracks.length ?? 0)
                : (groups?.length ?? 0),
        }
      : undefined;
    // The shared controller owns all requests and side effects. These providers
    // only select already prepared display data, never mount another controller.
    return {
      ...model,
      section: kind,
      group: null,
      selectedList: null,
      selectionMode: false,
      editingList: false,
      groupTracks: [],
      artistAlbums: [],
      onlyFavorites: kind === "songs" ? model.onlyFavorites : false,
      visible: searching ? foundTracks : model.tracks,
      catalogGroups: searching ? (foundGroups ?? []) : (groups ?? []),
      groupsTotal: groups?.length ?? 0,
      selectedGroupPage: {
        groups: groups ?? [],
        total: groups?.length ?? 0,
        status: index ? "ready" : "loading",
        loaded: !!index,
      },
      filteredLists: lists,
      filteredAutomatic: automatic,
      inlineSearch: {
        ...model.inlineSearch,
        active: searching,
        hasMore: false,
        pending: searching && kind !== "playlists" && !matched,
        stale: false,
        error: "",
        page: result,
      },
      recap: safeRecap ? model.recap : undefined,
    };
  };
  const index = librarySections.indexOf(section);
  const kinds = useMemo(() => {
    if (group || selectedList) return [section];
    const slots = librarySections.slice(Math.max(0, index - 1), index + 2);
    if (pager.destination && !slots.includes(pager.destination)) {
      const direction = Math.sign(
        librarySections.indexOf(pager.destination) - index,
      );
      const other = slots.filter(
        (k) => Math.sign(librarySections.indexOf(k) - index) !== direction,
      );
      return [...other, pager.destination];
    }
    return slots;
  }, [section, index, pager.destination, !!group, !!selectedList]);
  return (
    <div className="library-pager" data-paging-enabled={enabled}>
      <div ref={pager.track} className="library-pager-track">
        {kinds.map((kind) => (
          <Pane
            key={kind}
            kind={kind}
            active={kind === section}
            position={Math.sign(librarySections.indexOf(kind) - index)}
            model={kind === section ? model : preview(kind)}
          />
        ))}
      </div>
    </div>
  );
}
