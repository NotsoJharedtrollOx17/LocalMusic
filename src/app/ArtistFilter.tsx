import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { useMusicAppContext } from "./MusicAppContext";

export default function ArtistFilter({
  mode,
}: {
  mode: "include" | "exclude";
}) {
  const { request, setRequest, t } = useMusicAppContext();
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const label = mode === "include" ? t.includeArtist : t.excludeArtist;
  const primary = mode === "include" ? "includeArtist" : "excludeArtist";
  const extra = mode === "include" ? "includeArtists" : "excludeArtists";
  const values = request[extra] ?? [];
  return (
    <fieldset className="artist-filter" ref={fieldset}>
      <legend>{label}</legend>
      <input
        aria-label={label}
        list="artists"
        value={request[primary]}
        placeholder={mode === "include" ? t.anyArtist : "—"}
        onChange={(e) => {
          const value = e.target.value;
          setRequest((previous) => ({ ...previous, [primary]: value }));
        }}
      />
      {values.map((value, index) => (
        <div className="artist-filter-row" key={index}>
          <input
            data-artist-index={index}
            aria-label={`${label} ${index + 2}`}
            list="artists"
            value={value}
            placeholder={t.anyArtist}
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              setRequest((previous) => ({ ...previous, [extra]: next }));
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`${t.removeArtist}: ${label} ${index + 2}`}
            onClick={() => {
              setRequest((previous) => ({
                ...previous,
                [extra]: (previous[extra] ?? []).filter((_, i) => i !== index),
              }));
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          >
            <X size={18} />
          </button>
        </div>
      ))}
      {values.length < 2 && (
        <button
          type="button"
          ref={addButton}
          className="text-button artist-filter-add"
          aria-label={`${t.addArtist}: ${label}`}
          onClick={() => {
            const index = values.length;
            setRequest((previous) => ({
              ...previous,
              [extra]: [...(previous[extra] ?? []), ""],
            }));
            requestAnimationFrame(() =>
              fieldset.current
                ?.querySelector<HTMLInputElement>(
                  `[data-artist-index="${index}"]`,
                )
                ?.focus(),
            );
          }}
        >
          <Plus size={16} />
          {t.addArtist}
        </button>
      )}
    </fieldset>
  );
}
