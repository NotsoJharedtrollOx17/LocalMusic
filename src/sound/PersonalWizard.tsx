import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { soundCopy } from "./copy";
import { useBackLayer } from "../navigation";
import { usePersonalSetup } from "./usePersonalSetup";
import PersonalSetupIntro from "./PersonalSetupIntro";
import PersonalSetupTest from "./PersonalSetupTest";
import PersonalSetupResult from "./PersonalSetupResult";
import type { PersonalProfile } from "./types";

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
  const t = soundCopy(language);
  const {
    session,
    chart,
    pending,
    queued,
    answerQueued,
    stopped,
    error,
    now,
    act,
    interrupt,
    restart,
  } = usePersonalSetup();
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState(replacement?.name ?? t.defaultProfileName);
  const [mode, setMode] = useState<string>();
  const root = useRef<HTMLElement>(null);
  useBackLayer(true, onDone);
  // Change focus for a new screen, never for every answer or frequency update.
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>("h3")
      ?.focus({ preventScroll: true });
    root.current?.closest(".modal-body")?.scrollTo({ top: 0 });
  }, [session?.phase]);
  return (
    <section ref={root} className="personal-wizard" aria-label={t.setup}>
      {error && (
        <p className="sound-error" role="alert">
          {error}
        </p>
      )}
      {!session && !stopped ? (
        <PersonalSetupIntro
          language={language}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          pending={pending}
          routeMonitoring={routeMonitoring}
          onBegin={() => void act({ op: "start", replaceId: replacement?.id })}
          onCancel={onDone}
        />
      ) : session?.phase === "test" ? (
        <PersonalSetupTest
          language={language}
          session={session}
          chart={chart}
          pending={pending}
          queued={queued}
          answerQueued={answerQueued}
          now={now}
          onAnswer={(heard) =>
            void act({ op: "respond", id: session.id, heard })
          }
          onReplay={() => void act({ op: "pulse", id: session.id })}
          onStop={interrupt}
        />
      ) : session?.phase === "compare" ? (
        <PersonalSetupResult
          language={language}
          session={session}
          pending={pending}
          mode={mode}
          name={name}
          setName={setName}
          onPreview={(m) => {
            setMode(m);
            void act({ op: "preview", id: session.id, mode: m, strength: 100 });
          }}
          onSave={() =>
            void act({ op: "save", id: session.id, name, strength: 100 })
          }
          onStop={interrupt}
        />
      ) : session?.phase === "retry" ? (
        <div className="setup-recovery">
          <h3 tabIndex={-1}>{t.retest}</h3>
          <p role="status">
            {session.message === "reference-unheard"
              ? t.referenceUnheard
              : t.inconsistent}
          </p>
          <div className="setup-footer">
            <button
              className="button primary"
              disabled={pending}
              onClick={() => void act({ op: "retry", id: session.id })}
            >
              {t.retest}
            </button>
            <button className="text-button" onClick={interrupt}>
              {t.stop}
            </button>
          </div>
        </div>
      ) : session?.phase === "saved" ? (
        <div className="setup-recovery">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h3 tabIndex={-1}>{name}</h3>
          <p role="status">{t.savedProfile}</p>
          <button className="button primary" onClick={onDone}>
            {t.done}
          </button>
        </div>
      ) : (
        <div className="setup-recovery">
          <h3 tabIndex={-1}>{t.stop}</h3>
          <p role="status">{t.interrupted}</p>
          <div className="setup-footer">
            <button
              className="button primary"
              onClick={() => {
                restart();
                setConfirmed(false);
                setMode(undefined);
              }}
            >
              {t.restart}
            </button>
            <button className="button secondary" onClick={onDone}>
              {t.done}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
