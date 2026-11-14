import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Playlist, Track } from "../types";

export function useAutomaticPlaylists(
  active: boolean,
  revision: number,
  playbackKey: string,
  remember: (tracks: Track[]) => void,
  setSelectedList: React.Dispatch<React.SetStateAction<Playlist | null>>,
  ready = true,
) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const version = useRef(0),
    requests = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requests.current,
      generation = version.current;
    try {
      const next = await api.automaticPlaylists();
      const ids = [...new Set(next.flatMap((p) => p.trackIds))];
      const tracks = await api.tracksById(ids);
      if (request !== requests.current || generation !== version.current)
        return;
      remember(tracks);
      setPlaylists(next);
      setError("");
      setLoading(false);
      setSelectedList((current) =>
        current?.kind === "automatic"
          ? (next.find((p) => p.id === current.id) ?? current)
          : current,
      );
    } catch (e) {
      if (request === requests.current && generation === version.current) {
        setError(String(e));
        setLoading(false);
      }
    }
  }, [remember, setSelectedList]);
  useEffect(() => {
    if (active || !ready) return;
    const timer = setTimeout(() => {
      if (!document.hidden) void refresh();
    }, 120);
    return () => clearTimeout(timer);
  }, [active, ready, revision, playbackKey, refresh]);
  useEffect(() => {
    ++version.current;
    if (!active) return;
    void refresh();
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(tick, 5000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      ++version.current;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, revision, playbackKey, refresh]);
  return { playlists, loading, error, refresh };
}
