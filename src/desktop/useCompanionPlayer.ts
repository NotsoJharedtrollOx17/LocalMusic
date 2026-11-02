import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAppState } from "../app/useAppState";
import { useSoundController } from "../sound/useSoundController";
import { en, es } from "../i18n";
import { useSyncedSettings } from "./useSyncedSettings";
import {
  desktop,
  onDesktop,
  useDesktopWindows,
  type Change,
  type DetachedView,
} from "./windows";
import type { PlayerModel } from "../app/PlayerContext";
import type { Settings, Track, Playlist } from "../types";
import type { PlaylistContext } from "../playlists/types";

/** Only player state, queue metadata and explicitly opened dialogs. No Library/Recap controller. */
export function useCompanionPlayer(
  view: DetachedView,
  initialSettings?: Settings,
) {
  const state = useAppState(initialSettings),
    windows = useDesktopWindows();
  const entry = windows.windows.find((e) => e.view === view),
    active = entry?.phase === "detached";
  const t = state.settings?.language === "es" ? es : en;
  const latest = useRef(state);
  latest.current = state;
  const history = useRef<NonNullable<typeof state.modal>[]>([]);
  const initialized = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [playlistContext, setContext] = useState<PlaylistContext>({
    artists: [],
    genres: [],
    less: [],
    analyzed: 0,
    total: 0,
    scanning: false,
  });
  const [playlistContextLoaded, setContextLoaded] = useState(false),
    [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackUndo, setFeedbackUndo] = useState<{
    id: string;
    less: boolean;
  } | null>(null);
  const feedbackBusy = useRef(false);
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    state.setError("");
    try {
      return await fn();
    } catch (e) {
      state.setError(String(e));
    }
  }, []);
  useSyncedSettings(state.settings, state.setSettings, act);
  const soundController = useSoundController(
    state.modal === "equalizer" && !!active,
  );
  const remember = useCallback(
    (tracks: Track[]) =>
      state.setCache((old) => ({
        ...old,
        ...Object.fromEntries(tracks.map((t) => [t.id, t])),
      })),
    [],
  );
  const refreshLists = useCallback(
    async () => state.setLists(await api.playlists()),
    [],
  );
  const refreshContext = useCallback(async () => {
    setContext(await api.playlistContext());
    setContextLoaded(true);
  }, []);
  const dismissModals = () => {
    history.current = [];
    state.setPlayerParent(null);
    state.setModal(view === "player" ? "player" : view);
  };
  const setModal: PlayerModel["setModal"] = (action) => {
    const modal = latest.current.modal,
      next = typeof action === "function" ? action(modal) : action;
    if (next === null) {
      const previous = history.current.pop();
      if (previous) {
        state.setModal(previous);
        return;
      }
      void act(() => desktop.action({ op: "dismiss", view }));
      return;
    }
    if (next === "visualizer" && view === "player") {
      void act(() =>
        desktop.action({
          op: "navigate",
          kind: "visualizer",
          trackId: latest.current.player.trackId ?? "",
        }),
      );
      return;
    }
    if (next === "player" || next === "queue") {
      history.current = [];
      state.setPlayerParent(null);
      state.setModal(next);
      void act(() => desktop.action({ op: "queue", value: next === "queue" }));
      return;
    }
    if (modal && next !== modal) history.current.push(modal);
    if (modal === "player" || modal === "queue") state.setPlayerParent(modal);
    state.setModal(next);
  };
  useEffect(() => {
    let disposed = false;
    const off: Array<() => void> = [];
    let revision = 0;
    const setup = async () => {
      off.push(
        await api.subscribe((player) => {
          if (!disposed)
            state.setPlayer((old) =>
              player.revision !== undefined &&
              old.revision !== undefined &&
              player.revision < old.revision
                ? old
                : player,
            );
        }),
      );
      off.push(
        await onDesktop<Change>("changed", (event) => {
          if (disposed || event.revision <= revision) return;
          revision = event.revision;
          if (event.source === view) return;
          if (event.domain === "sound") {
            if (latest.current.modal === "equalizer")
              void soundController.refresh();
            return;
          }
          if (event.domain === "settings") return;
          void act(async () => {
            const s = latest.current;
            const ids = [
              ...new Set([
                ...s.player.queue.slice(0, s.queueLimit),
                ...(s.player.trackId ? [s.player.trackId] : []),
                ...s.actionIds,
                ...(s.detail ? [s.detail.id] : []),
              ]),
            ];
            const tracks = await api.tracksById(ids);
            if (disposed) return;
            remember(tracks);
            state.setDetail((old) =>
              old ? (tracks.find((t) => t.id === old.id) ?? old) : null,
            );
            if (event.domain === "playlists") await refreshLists();
            if (event.domain === "feedback" && s.menu) await refreshContext();
          });
        }),
      );
      // Reconcile after subscriptions, including any changes during window startup.
      const player = await api.playback();
      const tracks = await api.tracksById([
        ...new Set([
          ...player.queue.slice(0, 60),
          ...(player.trackId ? [player.trackId] : []),
        ]),
      ]);
      await refreshLists();
      if (!disposed) {
        state.setPlayer((old) =>
          player.revision !== undefined &&
          old.revision !== undefined &&
          player.revision < old.revision
            ? old
            : player,
        );
        remember(tracks);
        setLoaded(true);
      } else off.splice(0).forEach((fn) => fn());
    };
    void setup().catch((e) => {
      if (!disposed) state.setError(String(e));
    });
    const reconcile = () => {
      if (document.hidden) return;
      void act(async () => {
        const s = latest.current;
        const tracks = await api.tracksById([
          ...new Set([
            ...s.player.queue.slice(0, s.queueLimit),
            ...(s.player.trackId ? [s.player.trackId] : []),
            ...(s.detail ? [s.detail.id] : []),
          ]),
        ]);
        if (!disposed) {
          remember(tracks);
          state.setDetail((old) =>
            old ? (tracks.find((t) => t.id === old.id) ?? old) : null,
          );
          await refreshLists();
        }
      });
    };
    window.addEventListener("library-organization-changed", reconcile);
    void listen("library://metadata", reconcile).then((fn) => {
      if (disposed) fn();
      else off.push(fn);
    });
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      disposed = true;
      off.splice(0).forEach((fn) => fn());
      window.removeEventListener("library-organization-changed", reconcile);
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, []);
  useEffect(() => {
    if (!loaded || initialized.current || !entry) return;
    initialized.current = true;
    state.setModal(
      view === "player" ? (entry.queue ? "queue" : "player") : view,
    );
    void act(() =>
      desktop.action({ op: "ready", view, generation: entry.generation }),
    );
  }, [loaded, entry]);
  useEffect(() => {
    if (!initialized.current || view !== "player" || !active || !entry) return;
    const requested = entry.queue ? "queue" : "player";
    const current = latest.current.modal;
    // Keep an active child dialog intact; apply the requested base view on dismissal.
    if (current === "player" || current === "queue") state.setModal(requested);
    else {
      history.current = history.current.map((item) =>
        item === "player" || item === "queue" ? requested : item,
      );
      state.setPlayerParent(requested);
    }
  }, [active, entry?.queue]);
  // The host unmounts scenes first, then this effect acknowledges the released lease.
  useEffect(() => {
    if (entry?.phase === "returning")
      void (async () => {
        if (view === "equalizer") await soundController.flush();
        await desktop.action({
          op: "released",
          view,
          generation: entry.generation,
        });
      })().catch(() => {});
  }, [entry?.phase]);
  useEffect(() => {
    let dead = false;
    const ids = [
      ...new Set([
        ...state.player.queue.slice(0, state.queueLimit),
        ...(state.player.trackId ? [state.player.trackId] : []),
      ]),
    ];
    void api
      .tracksById(ids)
      .then((tracks) => {
        if (!dead) remember(tracks);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [state.player.trackId, state.player.queue.join("|"), state.queueLimit]);
  useEffect(() => {
    if (state.menu) void act(refreshContext);
  }, [!!state.menu]);
  const pickerVersion = useRef(0);
  const refreshPicker = useCallback(async (q = "", offset = 0) => {
    const version = ++pickerVersion.current;
    const page = await api.listTracks(q, offset, 60);
    if (version !== pickerVersion.current) return;
    state.setPickerTracks((old) =>
      offset ? [...old, ...page.tracks] : page.tracks,
    );
    state.setPickerTotal(page.total);
    remember(page.tracks);
  }, []);
  useEffect(() => {
    if (state.modal !== "manual") return;
    const timer = setTimeout(
      () => void act(() => refreshPicker(state.pickerQuery)),
      180,
    );
    return () => {
      clearTimeout(timer);
      pickerVersion.current++;
    };
  }, [state.modal, state.pickerQuery]);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (
        e.key !== " " ||
        e.defaultPrevented ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,button,[contenteditable],a",
        )
      )
        return;
      e.preventDefault();
      void act(() => api.toggle());
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => {
      if (!document.querySelector(".toast:focus-within")) state.setNotice("");
    }, 4500);
    return () => clearTimeout(timer);
  }, [state.notice]);
  useEffect(() => {
    if (!state.notice) setFeedbackUndo(null);
  }, [state.notice]);
  const favorite = async (track: Track) => {
    let saved = false;
    await act(async () => {
      await api.setFavorite(track.id, !track.favorite);
      const tracks = await api.tracksById([track.id]);
      remember(tracks);
      state.setDetail((old) => (old?.id === track.id ? tracks[0] : old));
      saved = true;
    });
    return saved;
  };
  const saveList = async (playlist: Playlist) => {
    await api.savePlaylist(playlist);
    await refreshLists();
    state.setNotice(t.playlistSaved);
  };
  const changeVisibility = async (ids: string[], visible: boolean) => {
    await api.setLibraryVisibility(ids, visible);
    remember(await api.tracksById(ids));
  };
  const suggestionFeedback = async (id: string, less: boolean) => {
    if (feedbackBusy.current) return;
    feedbackBusy.current = true;
    setFeedbackPending(true);
    const previous = playlistContext.less.includes(id);
    try {
      await api.setSuggestionFeedback(id, less);
      await refreshContext();
      setFeedbackUndo({ id, less: previous });
      state.setNotice(less ? t.suggestLessSaved : t.suggestionsRestored);
    } catch (e) {
      state.setError(String(e));
    } finally {
      feedbackBusy.current = false;
      setFeedbackPending(false);
    }
  };
  const share = async (ids: string[]) => {
    if (latest.current.sharing) return;
    state.setSharing(true);
    await act(async () => {
      const result = await api.shareAudio(ids);
      if (result !== "canceled")
        state.setNotice(
          result === "saved"
            ? t.copiesSaved
            : result === "download"
              ? t.downloadStarted
              : t.shareOpened,
        );
    });
    state.setSharing(false);
  };
  const openGroup: PlayerModel["openGroup"] = (kind, g) => {
    state.setMenu(null);
    void act(() =>
      desktop.action({ op: "navigate", kind, trackId: g.track.id }),
    );
  };
  const model: PlayerModel = {
    ...state,
    t,
    act,
    current: state.player.trackId
      ? state.cache[state.player.trackId]
      : undefined,
    setModal,
    dismissModals,
    soundController,
    favorite,
    saveList,
    changeVisibility,
    refreshLists,
    refreshPicker,
    share,
    openGroup,
    openEqualizer: async () => {
      if (windows.supported && view !== "equalizer")
        await act(() =>
          desktop.action({ op: "open", view: "equalizer", queue: false }),
        );
      else setModal("equalizer");
    },
    playlistContext,
    playlistContextLoaded,
    suggestionFeedback,
    feedbackUndo,
    setFeedbackUndo,
    feedbackPending,
    formatMusicCount: (count, songs = false) =>
      `${count.toLocaleString(state.settings?.language)} ${count === 1 ? t.songSingular : songs ? t.songCount : t.tracks}`,
  };
  return { model, active, loaded };
}
