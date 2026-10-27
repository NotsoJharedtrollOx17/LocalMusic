import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { PlaylistContext, PlaylistBlend } from "../playlists/types";
import type { MusicAppState } from "./useAppState";
import type { en } from "../i18n";

export function usePersonalizedPlaylists(state: MusicAppState, t: typeof en) {
  const [playlistContextLoaded, setPlaylistContextLoaded] = useState(false);
  const [context, setContext] = useState<PlaylistContext>({
    artists: [],
    genres: [],
    less: [],
    analyzed: 0,
    total: 0,
    scanning: false,
  });
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackUndo, setFeedbackUndo] = useState<{
    id: string;
    less: boolean;
  } | null>(null);
  const version = useRef(0),
    feedbackBusy = useRef(false),
    generationRevision = useRef(0);
  const inputKey = JSON.stringify([
    state.catalogRevision,
    state.settings?.privacyRevision,
    state.settings?.historyEnabledSince,
    state.player.excluded,
    state.request,
    state.target,
  ]);
  const previousKey = useRef(inputKey);
  if (previousKey.current !== inputKey) {
    generationRevision.current++;
    previousKey.current = inputKey;
  }
  const initialized = useRef(false);
  useEffect(() => {
    if (state.settings && !initialized.current) {
      initialized.current = true;
      state.setRequest((r) => ({
        ...r,
        blend: state.settings?.playlistBlend ?? "balanced",
      }));
    }
  }, [state.settings]);
  useEffect(() => {
    if (!state.notice) setFeedbackUndo(null);
  }, [state.notice]);
  const latest = useRef(state);
  latest.current = state;
  const refresh = async () => {
    const token = ++version.current;
    const next = await api.playlistContext();
    if (token === version.current && !feedbackBusy.current) {
      setContext((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      setPlaylistContextLoaded(true);
    }
  };
  useEffect(() => {
    void refresh().catch((e) => state.setError(String(e)));
  }, [state.catalogRevision]);
  // Analysis is authorized only by an explicit Generate action.
  const analysisRun = useRef(0);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        analysisRun.current++;
        void api.analysisActivity(false);
      }
    };
    document.addEventListener("visibilitychange", stop);
    return () => {
      analysisRun.current++;
      document.removeEventListener("visibilitychange", stop);
      void api.analysisActivity(false);
    };
  }, []);
  useEffect(() => {
    if (state.player.playing) {
      analysisRun.current++;
      void api.analysisActivity(false);
    }
  }, [state.player.playing]);
  async function prepareAnalysis() {
    const run = ++analysisRun.current;
    const allowed = () =>
      run === analysisRun.current &&
      !document.hidden &&
      !latest.current.player.playing &&
      !latest.current.importActive.current;
    if (!allowed()) return;
    // Bound each explicit request; cached descriptors accumulate across generations.
    const renew = window.setInterval(() => {
      if (allowed()) void api.analysisActivity(true).catch(() => {});
    }, 1500);
    try {
      await api.analysisActivity(true);
      for (let i = 0; i < 3 && allowed(); i++) {
        await api.analyzeNext();
      }
    } catch {
      // Metadata/history ranking remains available if source analysis fails.
    } finally {
      clearInterval(renew);
      await api.analysisActivity(false).catch(() => {});
      await refresh();
    }
  }
  async function suggestionFeedback(id: string, less: boolean) {
    if (feedbackBusy.current) return;
    feedbackBusy.current = true;
    setFeedbackPending(true);
    version.current++;
    generationRevision.current++;
    const previous = context.less.includes(id);
    setContext((c) => ({
      ...c,
      less: less
        ? [...new Set([...c.less, id])]
        : c.less.filter((x) => x !== id),
    }));
    try {
      await api.setSuggestionFeedback(id, less);
      setFeedbackUndo({ id, less: previous });
      state.setNotice(less ? t.suggestLessSaved : t.suggestionsRestored);
    } catch (e) {
      setContext((c) => ({
        ...c,
        less: previous
          ? [...new Set([...c.less, id])]
          : c.less.filter((x) => x !== id),
      }));
      state.setError(String(e));
    } finally {
      feedbackBusy.current = false;
      setFeedbackPending(false);
    }
  }
  function chooseBlend(blend: PlaylistBlend) {
    state.setRequest((r) => ({ ...r, blend }));
    state.setSettings((s) => (s ? { ...s, playlistBlend: blend } : s));
  }
  return {
    playlistContextLoaded,
    playlistContext: context,
    suggestionFeedback,
    feedbackPending,
    feedbackUndo,
    setFeedbackUndo,
    chooseBlend,
    generationRevision,
    prepareAnalysis,
  };
}
