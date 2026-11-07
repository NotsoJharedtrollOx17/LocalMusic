import { api, native } from "../api";
import { en } from "../i18n";
import { useEffect, useRef, useState } from "react";

import { type Track, type Playlist } from "../types";
import type { MusicAppState } from "./useAppState";
import type { useCatalogReads } from "./useCatalogReads";
type CatalogReads = ReturnType<typeof useCatalogReads>;
export function useMusicActions(
  state: MusicAppState,
  {
    act,
    remember,
    refresh,
    refreshLists,
    t,
    generationRevision,
    prepareAnalysis,
    collectionRequest,
  }: {
    act: (fn: () => Promise<unknown>) => Promise<unknown>;
    remember: (tracks: Track[]) => void;
    refresh: CatalogReads["refresh"];
    refreshLists: CatalogReads["refreshLists"];
    t: typeof en;
    generationRevision: React.RefObject<number>;
    prepareAnalysis: () => Promise<void>;
    collectionRequest: React.RefObject<number>;
  },
) {
  const generating = useRef(false);
  const [buildingMix, setBuildingMix] = useState(false);
  const [openingPlaylist, setOpeningPlaylist] = useState<string | null>(null);
  const openingRequest = useRef(0);
  useEffect(() => {
    setOpeningPlaylist(null);
  }, [state.section]);
  const [generationPhase, setGenerationPhase] = useState<"sound" | "matching">(
    "sound",
  );
  const {
    setTracks,
    query,
    onlyFavorites,
    group,
    setGroupTracks,
    selectedList,
    cache,
    setSelectedList,
    setGenerated,
    setBusy,
    setNotice,
    setError,
    detail,
    setDetail,
    setEditingList,
    request,
    target,
    setCatalogRevision,
    setChooserOpen,
    setImportProgress,
    importActive,
    latestQuery,
  } = state;
  async function favorite(track: Track) {
    let saved = false;
    await act(async () => {
      await api.setFavorite(track.id, !track.favorite);
      const next = { ...track, favorite: !track.favorite };
      remember([next]);
      setTracks((ts) => ts.map((x) => (x.id === track.id ? next : x)));
      setGroupTracks((ts) => ts.map((x) => (x.id === track.id ? next : x)));
      if (detail?.id === track.id) setDetail(next);
      if (onlyFavorites && !group) await refresh(query);
      setCatalogRevision((v) => v + 1);
      saved = true;
    });
    return saved;
  }
  async function doImport(files?: File[], mode?: "library" | "folder") {
    if (importActive.current) return;
    importActive.current = true;
    setBusy(true);
    setNotice("");
    const waitingForFolder = native && !/Android/i.test(navigator.userAgent);
    setChooserOpen(waitingForFolder);
    setImportProgress(waitingForFolder ? null : { imported: 0, failed: 0 });
    let selectionMade = !waitingForFolder;
    let refreshing: Promise<void> | undefined;
    let pending = false;
    const refreshBatch = () => {
      pending = true;
      if (refreshing) return;
      refreshing = (async () => {
        while (pending) {
          pending = false;
          await refresh(latestQuery.current);
          setCatalogRevision((revision) => revision + 1);
        }
      })()
        .catch((e) => setError(String(e)))
        .finally(() => {
          refreshing = undefined;
        });
    };
    try {
      await act(async () => {
        const n = await api.importMusic(files, mode, (progress) => {
          selectionMade = true;
          setChooserOpen(false);
          setImportProgress(progress);
          if (progress.imported + progress.failed > 0) refreshBatch();
        });
        await refreshing;
        if (selectionMade) setNotice(n + " " + t.imported);
      });
    } finally {
      await refreshing;
      try {
        await refresh(latestQuery.current);
        setCatalogRevision((revision) => revision + 1);
      } catch (e) {
        setError(String(e));
      }
      importActive.current = false;
      setChooserOpen(false);
      setImportProgress(null);
      setBusy(false);
    }
  }
  async function samples() {
    setBusy(true);
    await act(async () => {
      await api.addSamples();
      await refresh();
      setCatalogRevision((v) => v + 1);
      setNotice(t.soundOn);
    });
    setBusy(false);
  }
  async function openPlaylist(p: Playlist) {
    const version = ++collectionRequest.current;
    openingRequest.current = version;
    setOpeningPlaylist(p.id);
    state.playlistOrigin.current = { scroll: window.scrollY, id: p.id };
    try {
      await act(async () => {
        let tracks: Track[];
        try {
          tracks = await api.tracksById(p.trackIds);
        } catch (error) {
          if (version === collectionRequest.current) throw error;
          return;
        }
        if (version !== collectionRequest.current) return;
        remember(tracks);
        setSelectedList(p);
        setGenerated(null);
        setEditingList(false);
      });
    } finally {
      if (version === openingRequest.current) setOpeningPlaylist(null);
    }
  }
  function moveList(i: number, d: number, shownIds?: string[]) {
    if (!selectedList) return;
    const ids = [...selectedList.trackIds];
    const visible =
      shownIds ?? ids.filter((id) => cache[id] && !cache[id].hidden);
    const from = ids.indexOf(visible[i]),
      to = ids.indexOf(visible[i + d]);
    if (from < 0 || to < 0) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setSelectedList({ ...selectedList, trackIds: ids });
  }
  async function saveList(p: Playlist) {
    let saved = false;
    await act(async () => {
      await api.savePlaylist(p);
      saved = true;
      setNotice(t.playlistSaved);
      await refreshLists();
    });
    return saved;
  }
  async function buildMix() {
    if (generating.current) return;
    generating.current = true;
    setBuildingMix(true);
    setGenerationPhase("sound");
    const revision = generationRevision.current;
    setBusy(true);
    try {
      await act(async () => {
        await prepareAnalysis();
        if (revision !== generationRevision.current) return;
        setGenerationPhase("matching");
        const p = await api.generatePlaylist({
          ...request,
          seed: crypto.getRandomValues(new Uint32Array(1))[0],
          title: request.title || t.makePlaylist,
          targetCount: target,
          targetMinutes: undefined,
        });
        if (revision !== generationRevision.current) return;
        if (!p.trackIds.length) {
          setGenerated(null);
          setError(t.noCandidates);
          return;
        }
        const resultTracks = await api.tracksById(p.trackIds);
        if (revision !== generationRevision.current) return;
        remember(resultTracks);
        setGenerated(p);
      });
    } finally {
      setBusy(false);
      setBuildingMix(false);
      generating.current = false;
    }
  }
  return {
    favorite,
    doImport,
    samples,
    openPlaylist,
    moveList,
    saveList,
    buildMix,
    buildingMix,
    generationPhase,
    openingPlaylist,
  };
}
