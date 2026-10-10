import { useState, useEffect, useRef } from "react";
import { soundCopy } from "./copy";
import type { SoundConfig, PersonalProfile } from "./types";
export default function PersonalProfiles({
  config,
  edit,
  language,
  available,
  onSetup,
  onUse,
  routeGeneration,
}: {
  config: SoundConfig;
  edit: (update: (c: SoundConfig) => SoundConfig) => void;
  language: string;
  available: boolean;
  onSetup: (profile?: PersonalProfile) => void;
  onUse: (id: string) => void;
  routeGeneration: number;
}) {
  const t = soundCopy(language),
    [confirmed, setConfirmed] = useState(false),
    [renaming, setRenaming] = useState(false),
    [name, setName] = useState("");
  const selected = config.profiles.find((p) => p.id === config.profileId);
  const renameButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeEditor = () => {
    setRenaming(false);
    renameButton.current?.focus({ preventScroll: true });
  };
  useEffect(() => setConfirmed(false), [routeGeneration]);
  return (
    <section className="personal-profiles">
      <h3 ref={heading} tabIndex={-1}>
        {t.personal}
      </h3>
      <div className="sound-preset-grid">
        {config.profiles.map((p) => (
          <button
            key={p.id}
            aria-pressed={config.profileId === p.id}
            onClick={() => {
              setConfirmed(false);
              edit((c) => ({ ...c, profileId: p.id, personalEnabled: false }));
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {selected && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t.headphones}
          </label>
          <button
            className="button secondary"
            disabled={!available || (!config.personalEnabled && !confirmed)}
            onClick={() =>
              config.personalEnabled
                ? edit((c) => ({ ...c, personalEnabled: false }))
                : onUse(selected.id)
            }
          >
            {config.personalEnabled ? t.disableProfile : t.useProfile}
          </button>
          <label>
            {t.strength} <output>{config.strength}%</output>
            <input
              type="range"
              aria-label={t.strength}
              min={0}
              max={100}
              value={config.strength}
              onChange={(e) => {
                const strength = Number(e.target.value);
                edit((c) => ({ ...c, strength }));
              }}
            />
          </label>
          <div className="sound-actions">
            <button
              className="text-button"
              ref={renameButton}
              onClick={() => {
                setName(selected.name);
                setRenaming(true);
              }}
            >
              {t.rename}
            </button>
            <button className="text-button" onClick={() => onSetup(selected)}>
              {t.retestProfile}
            </button>
            <button
              className="text-button danger"
              onClick={() => {
                setRenaming(false);
                heading.current?.focus({ preventScroll: true });
                edit((c) => ({
                  ...c,
                  profiles: c.profiles.filter((p) => p.id !== selected.id),
                  profileId: null,
                  personalEnabled: false,
                }));
              }}
            >
              {t.remove}
            </button>
          </div>
          {renaming && (
            <form
              className="sound-name-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                edit((c) => ({
                  ...c,
                  profiles: c.profiles.map((p) =>
                    p.id === selected.id ? { ...p, name: name.trim() } : p,
                  ),
                }));
                closeEditor();
              }}
            >
              <label>
                {t.name}
                <input
                  autoFocus
                  aria-label={t.name}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={!name.trim()}>
                {t.save}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={closeEditor}
              >
                {t.cancel}
              </button>
            </form>
          )}
        </>
      )}
      {!available && <p>{t.multi}</p>}
      <button
        className="button secondary"
        disabled={!available}
        onClick={() => onSetup()}
      >
        {t.newProfile}
      </button>
    </section>
  );
}
