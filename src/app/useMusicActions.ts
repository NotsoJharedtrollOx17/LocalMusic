import { api, native } from "../api";
import { en } from "../i18n";

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
  }: {
    act: (fn: () => Promise<unknown>) => Promise<unknown>;
    remember: (tracks: Track[]) => void;
    refresh: CatalogReads["refresh"];
    refreshLists: CatalogReads["refreshLists"];
    t: typeof en;
  },
) {
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
    targetMode,
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
    await act(async () => {
      remember(await api.tracksById(p.trackIds));
      setSelectedList(p);
      setGenerated(null);
      setEditingList(false);
    });
  }
  function moveList(i: number, d: number) {
    if (!selectedList) return;
    const ids = [...selectedList.trackIds];
    const visible = ids.filter((id) => cache[id] && !cache[id].hidden);
    const from = ids.indexOf(visible[i]),
      to = ids.indexOf(visible[i + d]);
    if (from < 0 || to < 0) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setSelectedList({ ...selectedList, trackIds: ids });
  }
  async function saveList(p: Playlist) {
    await act(async () => {
      await api.savePlaylist(p);
      await refreshLists();
      setNotice(t.playlistSaved);
    });
  }
  async function buildMix() {
    setBusy(true);
    await act(async () => {
      const p = await api.generatePlaylist({
        ...request,
        title: request.title || t.makePlaylist,
        targetCount: targetMode === "count" ? target : undefined,
        targetMinutes: targetMode === "duration" ? target : undefined,
      });
      if (!p.trackIds.length) {
        setError(t.noCandidates);
        return;
      }
      remember(await api.tracksById(p.trackIds));
      setGenerated(p);
    });
    setBusy(false);
  }
  return {
    favorite,
    doImport,
    samples,
    openPlaylist,
    moveList,
    saveList,
    buildMix,
  };
}
