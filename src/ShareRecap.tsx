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
  const [format, setFormat] = useState<CardFormat>("story"),
    [prepared, setPrepared] = useState<{
      url: string;
      blob: Blob;
      recap: Recap;
    } | null>(null),
    [preparing, setPreparing] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true,
      url: string | undefined;
    setPreparing(true);
    setPrepared(null);
    setError("");
    setSaved(false);
    void (async () => {
      const current = await checkPrivacy(recap, language);
      const rendered = frozen ? recap : current;
      const blob = await renderRecapCard(rendered, language, format);
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPrepared({ url, blob, recap: rendered });
    })()
      .catch((e) => {
        if (active) setError(String(e instanceof Error ? e.message : e));
      })
      .finally(() => {
        if (active) setPreparing(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recap, language, format, frozen]);
  const size = cardDimensions(format);
  const download = async () => {
    if (!prepared || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await checkPrivacy(prepared.recap, language);
      const result = await saveBlob(
        prepared.blob,
        "your-year-" + recap.year + "-" + format + ".png",
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
          prepared && (
            <img
              className="recap-image-preview"
              src={prepared.url}
              alt={t.imagePreview + " " + recap.year}
            />
          )
        )}
        {error && (
          <p role="alert" className="share-error">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={preparing || saving || !prepared}
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
