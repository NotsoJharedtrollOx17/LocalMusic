import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { soundCopy } from "./copy";
import PersonalCurveBands from "./PersonalCurveBands";
import { useBackLayer } from "../navigation";
import type { PersonalAction, PersonalSession, PersonalProfile } from "./types";
export default function PersonalWizard({
  language,
  routeMonitoring,
  onDone,
  replacement,
}: {
  language: string;
  routeMonitoring: boolean;
  onDone: () => void;
  replacement?: PersonalProfile;
}) {
  useBackLayer(true, onDone);
  const t = soundCopy(language),
    [confirmed, setConfirmed] = useState(false),
    [session, setSession] = useState<PersonalSession>(),
    [pending, setPending] = useState(false),
    [replayQueued, setReplayQueued] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(replacement?.name ?? ""),
    [now, setNow] = useState(Date.now()),
    [strength, setStrength] = useState(50),
    [mode, setMode] = useState<string>();
  const current = useRef<PersonalSession | undefined>(undefined),
    alive = useRef(true),
    revision = useRef(0),
    replay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const act = async (action: PersonalAction) => {
    if (action.op === "cancel" || action.op === "start") {
      revision.current++;
      clearTimeout(replay.current);
      setReplayQueued(false);
    }
    const requested = revision.current;
    setPending(true);
    setError("");
    try {
      const next = await api.personalAction(action);
      if (alive.current && requested === revision.current) {
        current.current = next;
        setSession(next);
        if (action.op === "respond" && !action.heard && next.phase === "test") {
          clearTimeout(replay.current);
          setReplayQueued(true);
          replay.current = setTimeout(
            () => {
              if (alive.current) setReplayQueued(false);
              if (
                alive.current &&
                current.current?.id === next.id &&
                current.current.phase === "test"
              )
                void act({ op: "pulse", id: next.id });
            },
            Math.max(0, next.busyUntil + 550 - Date.now()),
          );
        }
      } else if (next.phase !== "saved")
        void api.personalAction({ op: "cancel", id: next.id }).catch(() => {});
    } catch (e) {
      if (alive.current && requested === revision.current) setError(String(e));
    } finally {
      if (alive.current && requested === revision.current) setPending(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    const clock = setInterval(() => setNow(Date.now()), 100);
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
            setSession(next);
            current.current = next;
          }
        })
        .catch((e) => {
          if (alive.current && current.current?.id === s.id) {
            setError(String(e));
            current.current = { ...s, phase: "cancelled" };
            setSession(current.current);
          }
        })
        .finally(() => {
          inFlight = false;
        });
    }, 500);
    const cancel = () => {
      revision.current++;
      clearTimeout(replay.current);
      if (alive.current) {
        setPending(false);
        setReplayQueued(false);
      }
      const s = current.current;
      if (s && !["saved", "cancelled"].includes(s.phase)) {
        void api.personalAction({ op: "cancel", id: s.id }).catch(() => {});
        current.current = { ...s, phase: "cancelled" };
        if (alive.current) setSession(current.current);
      }
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      clearInterval(clock);
      clearInterval(heartbeat);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
      cancel();
    };
  }, []);
  const busy = !!session && now < session.busyUntil;
  return (
    <section className="personal-wizard" aria-label={t.setup}>
      <h3 tabIndex={-1}>{t.setup}</h3>
      {error && (
        <p className="sound-error" role="alert">
          {error}
        </p>
      )}
      {!session ? (
        <>
          <p>{t.intro}</p>
          {!routeMonitoring && <p className="operation-note">{t.monitoring}</p>}
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t.headphones}
          </label>
          <button
            className="button primary"
            disabled={!confirmed || pending}
            onClick={() =>
              void act({ op: "start", replaceId: replacement?.id })
            }
          >
            {t.begin}
          </button>
        </>
      ) : session.phase === "test" ? (
        <>
          <p role="status">
            {session.ear === 0 ? t.left : t.right} · {t.progress}{" "}
            {session.ear * 7 + session.step + 1}/14
          </p>
          <div className="tone-frequency">
            {session.frequency < 1000
              ? `${session.frequency} Hz`
              : `${session.frequency / 1000} kHz`}
          </div>
          <p role="status">
            {t.toneLevel}: {session.level} dBFS
            {!session.awaiting && session.level > -54 ? ` ? ${t.nextTone}` : ""}
          </p>
          {[0, 6].includes(session.step) && <p>{t.reference}</p>}
          <button
            className="button secondary"
            disabled={pending || replayQueued || now < session.busyUntil + 500}
            onClick={() => void act({ op: "pulse", id: session.id })}
          >
            {t.playTone}
          </button>
          <div className="sound-actions">
            <button
              className="button primary"
              disabled={pending || busy || !session.awaiting}
              onClick={() =>
                void act({ op: "respond", id: session.id, heard: true })
              }
            >
              {t.heard}
            </button>
            <button
              className="button secondary"
              disabled={pending || busy || !session.awaiting}
              onClick={() =>
                void act({ op: "respond", id: session.id, heard: false })
              }
            >
              {t.notHeard}
            </button>
          </div>
        </>
      ) : session.phase === "retry" ? (
        <>
          <p role="status">
            {session.message === "reference-unheard"
              ? t.referenceUnheard
              : t.inconsistent}
          </p>
          <button
            className="button primary"
            disabled={pending}
            onClick={() => void act({ op: "retry", id: session.id })}
          >
            {t.retest}
          </button>
        </>
      ) : session.phase === "compare" ? (
        <>
          <h4>{t.compare}</h4>
          <p>{t.unknown}</p>
          <label>
            {t.strength} <output>{strength}%</output>
            <input
              aria-label={t.strength}
              type="range"
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
          <div className="sound-actions">
            {(["original", "personal"] as const).map((m) => (
              <button
                key={m}
                className="button secondary"
                aria-pressed={mode === m}
                disabled={pending}
                onClick={() => {
                  setMode(m);
                  void act({
                    op: "preview",
                    id: session.id,
                    mode: m,
                    strength,
                  });
                }}
              >
                {m === "original" ? t.original : t.personalPreview}
              </button>
            ))}
          </div>
          <form
            className="sound-name-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ op: "save", id: session.id, name, strength });
            }}
          >
            <label>
              {t.name}
              <input
                aria-label={t.name}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={pending || !name.trim()}
            >
              {t.saveProfile}
            </button>
          </form>
        </>
      ) : session.phase === "saved" ? (
        <>
          <p role="status">{t.savedProfile}</p>
          <button className="button primary" onClick={onDone}>
            {t.done}
          </button>
        </>
      ) : (
        <>
          <p role="status">{t.interrupted}</p>
          <button
            className="button primary"
            onClick={() => {
              revision.current++;
              clearTimeout(replay.current);
              setReplayQueued(false);
              setPending(false);
              current.current = undefined;
              setSession(undefined);
              setConfirmed(false);
              setError("");
            }}
          >
            {t.restart}
          </button>
          <button className="button secondary" onClick={onDone}>
            {t.done}
          </button>
        </>
      )}
      {session && ["test", "retry", "compare"].includes(session.phase) && (
        <>
          <p>{t.burst}</p>
          <PersonalCurveBands
            provisional={session.phase !== "compare"}
            left={session.left ?? Array(10).fill(0)}
            right={session.right ?? Array(10).fill(0)}
            strength={session.phase === "compare" ? strength : 100}
            language={language}
          />
        </>
      )}
      {session && !["saved", "cancelled"].includes(session.phase) && (
        <button
          className="text-button"
          disabled={pending}
          onClick={() => void act({ op: "cancel", id: session.id })}
        >
          {t.stop}
        </button>
      )}
      {!session && (
        <button className="text-button" onClick={onDone}>
          {t.cancel}
        </button>
      )}
    </section>
  );
}
