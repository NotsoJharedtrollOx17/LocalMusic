import { periodLabel } from "./recap/periods";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, LoaderCircle } from "lucide-react";
import { Modal } from "./components";
import { en, es } from "./i18n";
import {
  cardDimensions,
  checkPrivacy,
  renderRecapCard,
  saveBlob,
  type CardFormat,
} from "./export";
import type { Recap } from "./types";
export default function ShareRecap({
  recap,
  language,
  frozen,
  onClose,
}: {
  recap: Recap;
  language: "en" | "es";
  frozen: boolean;
  onClose: () => void;
}) {
  const t = language === "es" ? es : en;
  const [attempt, setAttempt] = useState(0);
  const [format, setFormat] = useState<CardFormat>("story"),
    [prepared, setPrepared] = useState<{
      url: string;
      blob: Blob;
      recap: Recap;
      source: Recap;
      format: CardFormat;
      language: "en" | "es";
    } | null>(null),
    [preparing, setPreparing] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      url: string | undefined;
    setPreparing(true);
    setPrepared(null);
    setError("");
    setSaved(false);
    void (async () => {
      const current = await checkPrivacy(recap, language, frozen);
      const rendered = frozen ? recap : current;
      const blob = await renderRecapCard(
        rendered,
        language,
        format,
        controller.signal,
      );
      if (!active) return;
      await checkPrivacy(rendered, language, frozen);
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPrepared({
        url,
        blob,
        recap: rendered,
        source: recap,
        format,
        language,
      });
    })()
      .catch((e) => {
        if (active) setError(String(e instanceof Error ? e.message : e));
      })
      .finally(() => {
        if (active) setPreparing(false);
      });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [recap, language, format, frozen, attempt]);
  const ready =
    prepared?.format === format &&
    prepared.source === recap &&
    prepared.language === language
      ? prepared
      : null;
  const size = cardDimensions(format);
  const download = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await checkPrivacy(ready.recap, language, frozen);
      const result = await saveBlob(
        ready.blob,
        `your-recap-${recap.period.kind}-${recap.period.startDate}-${format}.png`,
      );
      if (result !== false) setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={t.shareCard} closeLabel={t.close} onClose={onClose} wide>
      <div className="share-recap">
        <p className="small-muted">{t.imageIntro}</p>
        <div className="image-formats" role="group" aria-label={t.imageFormat}>
          {(["story", "feed"] as const).map((value) => (
            <button
              key={value}
              className={
                "button " + (format === value ? "primary" : "secondary")
              }
              aria-pressed={format === value}
              disabled={saving}
              onClick={() => setFormat(value)}
            >
              {value === "story" ? t.storyFormat : t.feedFormat}
            </button>
          ))}
        </div>
        <p className="image-size">
          {size.width} × {size.height} · PNG
        </p>
        {preparing ? (
          <div className="image-loading" role="status">
            <LoaderCircle className="spinner" />
            {t.preparingImage}
          </div>
        ) : (
          ready && (
            <img
              className="recap-image-preview"
              src={ready.url}
              alt={t.imagePreview + " " + periodLabel(recap.period, language)}
            />
          )
        )}
        {error && (
          <div className="share-error">
            <p role="alert">{error}</p>
            {!ready && (
              <button
                className="button secondary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t.retry}
              </button>
            )}
          </div>
        )}
        <button
          className="button primary full-width"
          disabled={preparing || saving || !ready}
          onClick={() => void download()}
        >
          {saving ? (
            <LoaderCircle className="spinner" size={18} />
          ) : (
            <Download size={18} />
          )}
          {saving ? t.savingImage : t.downloadImage}
        </button>
        {saved && (
          <div
            role="status"
            aria-live="polite"
            className="toast recap-save-toast"
          >
            <CheckCircle2 size={24} aria-hidden="true" />
            <strong>{t.imageSaved}</strong>
          </div>
        )}
        <p className="method-note">{t.imagePrivacy}</p>
      </div>
    </Modal>
  );
}
