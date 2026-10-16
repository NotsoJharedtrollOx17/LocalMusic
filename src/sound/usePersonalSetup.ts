import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { PersonalAction, PersonalSession } from "./types";

/** Presentation scheduling only; tone limits, responses and leases stay in the backend. */
export function usePersonalSetup() {
  const [session, setSession] = useState<PersonalSession>();
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<PersonalSession | undefined>(undefined);
  const alive = useRef(true);
  const revision = useRef(0);
  const locked = useRef(false);
  const inFlightAction = useRef<PersonalAction["op"] | undefined>(undefined);
  const waitingAnswer = useRef<
    Extract<PersonalAction, { op: "respond" }> | undefined
  >(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [answerQueued, setAnswerQueued] = useState(false);
  const [stopped, setStopped] = useState(false);
  const interruption = useRef<"pause" | "cancel">("cancel");

  function clearQueue() {
    clearTimeout(timer.current);
    if (alive.current) setQueued(false);
    if (alive.current) setAnswerQueued(false);
  }
  function publish(next: PersonalSession) {
    current.current = next;
    setSession(next);
  }
  async function act(action: PersonalAction) {
    const interrupt = ["cancel", "start", "pause", "resume"].includes(
      action.op,
    );
    if (locked.current && !interrupt) {
      // A background repeat must not swallow a click made while its IPC is pending.
      if (
        action.op === "respond" &&
        inFlightAction.current === "pulse" &&
        !waitingAnswer.current
      ) {
        waitingAnswer.current = action;
        clearQueue();
        setPending(true);
        setAnswerQueued(true);
      }
      return;
    }
    if (interrupt) {
      revision.current++;
      interruption.current = action.op === "pause" ? "pause" : "cancel";
      waitingAnswer.current = undefined;
    }
    if (action.op === "start") setStopped(false);
    clearQueue();
    const requested = revision.current;
    if (
      action.op === "respond" &&
      current.current &&
      Date.now() < current.current.busyUntil
    ) {
      locked.current = true;
      setPending(true);
      setAnswerQueued(true);
      timer.current = setTimeout(
        () => {
          if (!alive.current || revision.current !== requested) return;
          locked.current = false;
          setAnswerQueued(false);
          void act(action);
        },
        current.current.busyUntil + 50 - Date.now(),
      );
      return;
    }
    locked.current = true;
    inFlightAction.current = action.op;
    // Repeating audio is background work, not a new screen/loading transition.
    if (action.op !== "pulse") setPending(true);
    setError("");
    let succeeded = false;
    try {
      const next = await api.personalAction(action);
      if (!alive.current || requested !== revision.current) {
        if (next.phase !== "saved") {
          if (
            alive.current &&
            interruption.current === "pause" &&
            requested + 1 === revision.current
          ) {
            const pausedRevision = revision.current;
            const paused = await api.personalAction({
              op: "pause",
              id: next.id,
            });
            if (alive.current && revision.current === pausedRevision) {
              publish(paused);
              setPending(false);
            } else if (!alive.current)
              void api
                .personalAction({ op: "cancel", id: next.id })
                .catch(() => {});
          } else if (!alive.current || current.current?.id !== next.id) {
            void api
              .personalAction({ op: "cancel", id: next.id })
              .catch(() => {});
          }
        }
        return;
      }
      publish(next);
      succeeded = true;
      // Every accepted answer advances automatically; unanswered tones never advance.
      if (
        next.phase === "test" &&
        ["start", "respond", "retry", "resume", "pulse"].includes(action.op)
      ) {
        setQueued(action.op !== "pulse");
        timer.current = setTimeout(
          () => {
            if (
              !alive.current ||
              revision.current !== requested ||
              current.current?.id !== next.id ||
              current.current.phase !== "test" ||
              current.current.trialId !== next.trialId
            )
              return;
            setQueued(false);
            void act({ op: "pulse", id: next.id, trialId: next.trialId });
          },
          Math.max(
            0,
            next.busyUntil + (action.op === "pulse" ? 1500 : 550) - Date.now(),
          ),
        );
      }
    } catch (e) {
      if (alive.current && requested === revision.current) setError(String(e));
    } finally {
      if (alive.current && requested === revision.current) {
        locked.current = false;
        inFlightAction.current = undefined;
        const answer = waitingAnswer.current;
        waitingAnswer.current = undefined;
        if (answer && succeeded) void act(answer);
        else if (action.op !== "pulse" || !succeeded) {
          setPending(false);
          if (!succeeded) clearQueue();
        }
      }
    }
  }
  function interrupt() {
    interruption.current = "cancel";
    const wasStarting = locked.current && !current.current;
    revision.current++;
    clearQueue();
    locked.current = false;
    inFlightAction.current = undefined;
    waitingAnswer.current = undefined;
    if (alive.current) setPending(false);
    const s = current.current;
    if (
      alive.current &&
      (wasStarting || (s && !["saved", "cancelled"].includes(s.phase)))
    )
      setStopped(true);
    if (s && !["saved", "cancelled"].includes(s.phase)) {
      current.current = { ...s, phase: "cancelled", awaiting: false };
      if (alive.current) setSession(current.current);
      void api.personalAction({ op: "cancel", id: s.id }).catch(() => {});
    }
  }
  function pause() {
    const s = current.current;
    if (s && !["saved", "cancelled", "paused"].includes(s.phase)) {
      void act({ op: "pause", id: s.id });
    } else if (!s && locked.current) {
      // A start command can finish after focus has left. Pause its acknowledgement.
      interruption.current = "pause";
      revision.current++;
      clearQueue();
      locked.current = false;
    }
  }
  useEffect(() => {
    alive.current = true;
    let inFlight = false;
    const heartbeat = setInterval(() => {
      const s = current.current;
      if (!s || ["saved", "cancelled", "paused"].includes(s.phase) || inFlight)
        return;
      inFlight = true;
      const requested = revision.current;
      void api
        .personalAction({ op: "heartbeat", id: s.id })
        .then((next) => {
          if (revision.current !== requested) return;
          if (
            alive.current &&
            current.current?.id === s.id &&
            next.phase === "paused" &&
            current.current.phase !== "paused"
          ) {
            pause();
          } else if (
            alive.current &&
            current.current?.id === s.id &&
            next.phase === "cancelled"
          ) {
            interrupt();
            publish(next);
          }
        })
        .catch((e) => {
          if (
            alive.current &&
            revision.current === requested &&
            current.current?.id === s.id
          ) {
            setError(String(e));
            interrupt();
          }
        })
        .finally(() => {
          inFlight = false;
        });
    }, 500);
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      clearInterval(heartbeat);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
      interrupt();
    };
  }, []);
  function restart() {
    interrupt();
    current.current = undefined;
    setSession(undefined);
    setError("");
    setStopped(false);
  }
  return {
    session,
    pending,
    queued,
    answerQueued,
    stopped,
    error,
    act,
    interrupt,
    restart,
  };
}
