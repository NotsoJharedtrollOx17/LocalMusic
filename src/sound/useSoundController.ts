import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../api";
import type { SoundState, SoundConfig, SoundAction } from "./types";
/** A single serialized writer; polls never replace an unacknowledged draft. */
export function useSoundController(
  initial: SoundState,
  onState: (s: SoundState) => void,
) {
  const [state, setState] = useState(initial),
    [draft, setDraft] = useState(initial.config),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const latest = useRef(initial.config),
    ack = useRef(initial.config),
    queued = useRef<SoundConfig | null>(null),
    writing = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true),
    bypassed = useRef(initial.bypass);
  bypassed.current = state.bypass;
  const drain = useCallback(async () => {
    if (writing.current) return;
    writing.current = true;
    if (alive.current) setPending(true);
    while (queued.current) {
      const config = queued.current;
      queued.current = null;
      try {
        const s = await api.setSound(config);
        ack.current = s.config;
        if (alive.current) {
          setState(s);
          onState(s);
          if (latest.current === config) {
            latest.current = s.config;
            setDraft(s.config);
          }
          setError("");
        }
      } catch (e) {
        if (alive.current) {
          setError(String(e));
          if (!queued.current) {
            latest.current = ack.current;
            setDraft(ack.current);
          }
        }
      }
    }
    writing.current = false;
    if (alive.current) setPending(false);
  }, [onState]);
  const edit = (update: (c: SoundConfig) => SoundConfig) => {
    const next = update(latest.current);
    latest.current = next;
    setDraft(next);
    queued.current = next;
    setPending(true);
    if (!timer.current)
      timer.current = setTimeout(() => {
        timer.current = undefined;
        void drain();
      }, 50);
  };
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    void drain();
  };
  const refresh = useCallback(async () => {
    try {
      const requested = latest.current;
      const s = await api.soundCapabilities();
      if (alive.current) {
        setState(s);
        onState(s);
        if (
          !writing.current &&
          !queued.current &&
          requested === latest.current
        ) {
          latest.current = s.config;
          ack.current = s.config;
          setDraft(s.config);
        }
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    }
  }, [onState]);
  const action = async (action: SoundAction) => {
    flush();
    while (writing.current)
      await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      const s = await api.soundAction(action);
      if (!alive.current && action.op === "bypass" && action.value)
        void api.soundAction({ op: "bypass", value: false }).catch(() => {});
      if (alive.current) {
        setState(s);
        onState(s);
        if (!queued.current) {
          latest.current = s.config;
          ack.current = s.config;
          setDraft(s.config);
        }
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    }
  };
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => void refresh(), 1000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      if (bypassed.current)
        void api.soundAction({ op: "bypass", value: false }).catch(() => {});
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (queued.current) void drain();
    },
    [drain],
  );
  return { state, draft, edit, flush, refresh, action, pending, error };
}
