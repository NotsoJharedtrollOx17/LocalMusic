import { useState, useRef } from "react";
import { BUILT_INS } from "./model";
import { soundCopy } from "./copy";
import type { SoundConfig } from "./types";
export default function SoundPresetList({
  config,
  edit,
  language,
}: {
  config: SoundConfig;
  edit: (update: (c: SoundConfig) => SoundConfig) => void;
  language: string;
}) {
  const t = soundCopy(language),
    [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState("");
  const selected = config.presets.find((p) => p.id === config.presetId);
  const origin = useRef<HTMLButtonElement | null>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const closeEditor = () => {
    setEditing(null);
    (origin.current?.isConnected ? origin.current : saveButton.current)?.focus({
      preventScroll: true,
    });
  };
  return (
    <div className="sound-presets">
      <fieldset>
        <legend>{t.presets}</legend>
        <div className="sound-preset-grid">
          {[...BUILT_INS, ...config.presets].map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={config.presetId === p.id}
              onClick={() =>
                edit((c) => ({
                  ...c,
                  enabled: true,
                  presetId: p.id,
                  gains: [...p.gains],
                  preamp: p.preamp,
                }))
              }
            >
              {t.presetNames[p.id as keyof typeof t.presetNames] ?? p.name}
            </button>
          ))}
          {config.presetId === "custom" && (
            <span className="sound-custom">{t.custom}</span>
          )}
        </div>
      </fieldset>
      <div className="sound-actions">
        <button
          type="button"
          ref={saveButton}
          className="text-button"
          onClick={(e) => {
            origin.current = e.currentTarget;
            setName("");
            setEditing("new");
          }}
        >
          {t.savePreset}
        </button>
        {selected && (
          <>
            <button
              type="button"
              className="text-button"
              onClick={(e) => {
                origin.current = e.currentTarget;
                setName(selected.name);
                setEditing(selected.id);
              }}
            >
              {t.rename}
            </button>
            <button
              type="button"
              className="text-button danger"
              onClick={() => {
                saveButton.current?.focus({ preventScroll: true });
                edit((c) => ({
                  ...c,
                  presetId: "custom",
                  presets: c.presets.filter((p) => p.id !== selected.id),
                }));
              }}
            >
              {t.remove}
            </button>
          </>
        )}
      </div>
      {editing && (
        <form
          className="sound-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = `user-${crypto.randomUUID()}`;
            edit((c) =>
              editing === "new"
                ? {
                    ...c,
                    presetId: id,
                    presets: [
                      ...c.presets,
                      {
                        id,
                        name: name.trim(),
                        gains: [...c.gains],
                        preamp: c.preamp,
                      },
                    ],
                  }
                : {
                    ...c,
                    presets: c.presets.map((p) =>
                      p.id === editing ? { ...p, name: name.trim() } : p,
                    ),
                  },
            );
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
    </div>
  );
}
