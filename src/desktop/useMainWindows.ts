import { useEffect, useRef, useState } from "react";
import type { MusicAppState } from "../app/useAppState";
import type { useMusicApp } from "../app/useMusicApp";
import { api, native } from "../api";
import {
  desktop,
  onDesktop,
  useDesktopWindows,
  type WindowEntry,
  type Change,
} from "./windows";
type Model = ReturnType<typeof useMusicApp>;
export function useMainWindows(
  state: MusicAppState,
  actions: Pick<
    Model,
    | "remember"
    | "openGroup"
    | "setModal"
    | "dismissModals"
    | "act"
    | "refresh"
    | "refreshLists"
  >,
) {
  const windows = useDesktopWindows();
  const hadCompanion = useRef(false);
  if (windows.windows.length) hadCompanion.current = true;
  const latest = useRef({ state, actions });
  latest.current = { state, actions };
  const [pending, setPending] = useState<WindowEntry[]>([]);
  useEffect(() => {
    if (!native) return;
    let dead = false;
    const cleanup: Array<() => void> = [];
    let revision = 0;
    const register = async <T>(event: string, fn: (data: T) => void) => {
      const off = await onDesktop(event, fn);
      if (dead) off();
      else cleanup.push(off);
    };
    void register<WindowEntry>("returned", (entry) =>
      setPending((old) => [...old, entry]),
    );
    void register<string>("error", (message) =>
      latest.current.state.setError(message),
    );
    void register<Change>("changed", (change) => {
      if (change.revision <= revision) return;
      revision = change.revision;
      if (change.source === "main") return;
      const { state: s, actions: a } = latest.current;
      if (
        ["catalog", "playlists", "feedback", "privacy"].includes(change.domain)
      ) {
        s.setCatalogRevision((v) => v + 1);
        s.setRecapRevision((v) => v + 1);
        const ids = [
          ...new Set([
            ...(change.ids ?? []),
            ...s.player.queue,
            ...(s.detail ? [s.detail.id] : []),
          ]),
        ];
        void a.act(async () => {
          const tracks = await api.tracksById(ids);
          a.remember(tracks);
          s.setDetail((old) =>
            old ? (tracks.find((track) => track.id === old.id) ?? old) : null,
          );
          if (change.domain === "catalog") await a.refresh();
          if (change.domain === "playlists") {
            const lists = await api.playlists();
            s.setLists(lists);
            if (!s.editingList)
              s.setSelectedList((old) =>
                old && old.kind !== "automatic"
                  ? (lists.find((list) => list.id === old.id) ?? null)
                  : old,
              );
          }
        });
      }
    });
    void register<{
      kind: "albums" | "artists" | "visualizer";
      trackId: string;
    }>("navigate", (request) => {
      const { actions: a } = latest.current;
      if (request.kind === "visualizer") {
        a.setModal("visualizer");
        return;
      }
      void a.act(async () => {
        const [track] = await api.tracksById([request.trackId]);
        if (!track) return;
        a.remember([track]);
        a.dismissModals();
        a.openGroup(request.kind as "albums" | "artists", {
          title: request.kind === "albums" ? track.album : track.artist,
          subtitle: request.kind === "albums" ? track.artist : "",
          ids: [track.id],
          track,
        });
      });
    });
    const reconcile = () => {
      if (document.hidden || !hadCompanion.current) return;
      void latest.current.actions.act(async () => {
        const next = await desktop.reconcile();
        if (!next.revision || next.revision <= revision) return;
        revision = Math.max(revision, next.revision);
        const { state: s, actions: a } = latest.current;
        s.setCatalogRevision((v) => v + 1);
        await a.refresh();
        await a.refreshLists();
      });
    };
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      dead = true;
      cleanup.forEach((off) => off());
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, []);
  // First commit removes source renderers/dialogs. The following effect acknowledges cleanup.
  const [releasing, setReleasing] = useState<WindowEntry[]>([]);
  useEffect(() => {
    const transfers = windows.windows.filter((e) => e.phase === "transferring");
    if (!transfers.length) return;
    const { state: s, actions: a } = latest.current;
    if (
      transfers.some(
        (e) =>
          e.view === "player" &&
          (s.modal === "player" || s.modal === "queue" || s.playerParent),
      )
    )
      a.dismissModals();
    if (
      transfers.some((e) => e.view === "visualizer") &&
      s.modal === "visualizer"
    )
      a.dismissModals();
    setReleasing(transfers);
  }, [windows]);
  useEffect(() => {
    for (const entry of releasing)
      void desktop
        .action({
          op: "released",
          view: entry.view,
          generation: entry.generation,
        })
        .catch((e) => state.setError(String(e)));
  }, [releasing]);
  useEffect(() => {
    if (!pending.length || state.modal || state.shareRecap || state.menu)
      return;
    const [entry, ...rest] = pending;
    setPending(rest);
    actions.setModal(
      entry.view === "visualizer"
        ? "visualizer"
        : entry.queue
          ? "queue"
          : "player",
    );
  }, [pending, state.modal, state.shareRecap, state.menu]);
}
