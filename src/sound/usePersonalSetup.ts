import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { PersonalAction, PersonalSession } from "./types";
import { setupPreview } from "./setupPreview";

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
  const [pendingNo, setPendingNo] = useState(false);
  const references = useRef<(number | undefined)[]>([undefined, undefined]);

  function clearQueue() {
    clearTimeout(timer.current);
    if (alive.current) setQueued(false);
    if (alive.current) setAnswerQueued(false);
    if (alive.current) setPendingNo(false);
  }
  function publish(next: PersonalSession) {
    current.current = next;
    setSession(next);
  }
  async function act(action: PersonalAction) {
    const interrupt = action.op === "cancel" || action.op === "start";
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
        setPendingNo(!action.heard && current.current?.level !== -36);
      }
      return;
    }
    if (interrupt) {
      revision.current++;
    }
    if (action.op === "start") setStopped(false);
    if (action.op === "start") references.current = [undefined, undefined];
    if (action.op === "retry" && current.current)
      references.current[current.current.ear] = undefined;
    clearQueue();
    if (
      action.op === "respond" &&
      !action.heard &&
      current.current?.level !== -36
    )
      setPendingNo(true);
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
    const before = current.current;
    let succeeded = false;
    try {
      const next = await api.personalAction(action);
      if (!alive.current || requested !== revision.current) {
        if (next.phase !== "saved")
          void api
            .personalAction({ op: "cancel", id: next.id })
            .catch(() => {});
        return;
      }
      if (action.op === "respond" && action.heard && before?.step === 0)
        references.current[before.ear] = before.level;
      publish(next);
      succeeded = true;
      // Every accepted answer advances automatically; unanswered tones never advance.
      if (
        next.phase === "test" &&
        ["start", "respond", "retry", "pulse"].includes(action.op)
      ) {
        setQueued(action.op !== "pulse");
        timer.current = setTimeout(
          () => {
            if (
              !alive.current ||
              revision.current !== requested ||
              current.current?.id !== next.id ||
              current.current.phase !== "test"
            )
              return;
            setQueued(false);
            void act({ op: "pulse", id: next.id });
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
          setPendingNo(false);
          if (!succeeded) clearQueue();
        }
      }
    }
  }
  function interrupt() {
    const wasStarting = locked.current && !current.current;
    revision.current++;
    clearQueue();
    references.current = [undefined, undefined];
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
  useEffect(() => {
    alive.current = true;
    let inFlight = false;
    const heartbeat = setInterval(() => {
      const s = current.current;
      if (!s || ["saved", "cancelled"].includes(s.phase) || inFlight) return;
      inFlight = true;
      void api
        .personalAction({ op: "heartbeat", id: s.id })
        .then((next) => {
          if (
            alive.current &&
            current.current?.id === s.id &&
            next.phase === "cancelled"
          ) {
            interrupt();
            publish(next);
          }
        })
        .catch((e) => {
          if (alive.current && current.current?.id === s.id) {
            setError(String(e));
            interrupt();
          }
        })
        .finally(() => {
          inFlight = false;
        });
    }, 500);
    const hidden = () => {
      if (document.hidden) interrupt();
    };
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      clearInterval(heartbeat);
      window.removeEventListener("blur", interrupt);
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
    chart: session
      ? setupPreview(session, references.current[session.ear], pendingNo)
      : undefined,
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
