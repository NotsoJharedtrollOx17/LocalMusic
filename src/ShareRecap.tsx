import { native } from "./api";
import { periodLabel } from "./recap/periods";
import { useEffect, useState, useRef, useMemo } from "react";
import { CheckCircle2, Download, LoaderCircle, Share2 } from "lucide-react";
import { Modal } from "./components";
import { en, es } from "./i18n";
import {
  cardDimensions,
  imageExportCapabilities,
  shareImage,
  type ImageExportCapabilities,
  checkPrivacy,
  renderRecapCard,
  saveImage,
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
  const androidPreview = native && /Android/i.test(navigator.userAgent);
  const t = language === "es" ? es : en;
  const alive = useRef(true);
  const [capabilities, setCapabilities] = useState<ImageExportCapabilities>({
    save: native ? "picker" : "download",
    share: native
      ? /Android/i.test(navigator.userAgent)
      : typeof navigator.share === "function" &&
        typeof navigator.canShare === "function",
  });
  useEffect(() => {
    alive.current = true;
    void imageExportCapabilities()
      .then((c) => {
        if (
          alive.current &&
          c &&
          ["gallery", "picker", "download"].includes(c.save)
        )
          setCapabilities(c);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, []);
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
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
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
        androidPreview ? 0.25 : 1,
      );
      if (!active) return;
      await checkPrivacy(rendered, language, frozen);
      if (!active) return;
      url = URL.createObjectURL(blob);
      const preview = new Image();
      preview.src = url;
      await preview.decode();
      if (!active) return;
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
  const canShare = useMemo(() => {
    if (!capabilities.share || !ready) return false;
    if (native) return true;
    try {
      return !!navigator.canShare?.({
        files: [new File([ready.blob], "recap.png", { type: "image/png" })],
      });
    } catch {
      return false;
    }
  }, [capabilities.share, ready]);
  const size = cardDimensions(format);
  const exportBlob = async (card: NonNullable<typeof ready>) => {
    if (androidPreview) await checkPrivacy(card.recap, language, frozen);
    const blob = androidPreview
      ? await renderRecapCard(card.recap, language, format)
      : card.blob;
    await checkPrivacy(card.recap, language, frozen);
    return blob;
  };
  const download = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const blob = await exportBlob(ready);
      if (!alive.current) return;
      const result = await saveImage(
        blob,
        `your-recap-${recap.period.kind}-${recap.period.startDate}-${format}.png`,
      );
      if (result !== "canceled" && alive.current) setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  const share = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const blob = await exportBlob(ready);
      if (!alive.current) return;
      const result = await shareImage(
        blob,
        `your-recap-${recap.period.kind}-${recap.period.startDate}-${format}.png`,
      );
      if (result === "unavailable" && alive.current)
        setError(t.imageShareUnavailable);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setSaving(false);
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
        <div className="recap-preview-stage" aria-busy={preparing}>
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
        </div>
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
        <div className="recap-export-actions">
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
          {capabilities.share && (
            <button
              className="button secondary full-width"
              disabled={preparing || saving || !ready || !canShare}
              title={ready && !canShare ? t.imageShareUnavailable : undefined}
              onClick={() => void share()}
            >
              <Share2 size={18} />
              {t.shareImage}
            </button>
          )}
        </div>
        <div className="recap-save-status" role="status" aria-live="polite">
          {saved && (
            <div className="recap-save-toast">
              <CheckCircle2 size={24} aria-hidden="true" />
              <strong>
                {capabilities.save === "gallery"
                  ? t.imageSavedDevice
                  : capabilities.save === "download"
                    ? t.imageDownloadStarted
                    : t.imageSaved}
              </strong>
            </div>
          )}
        </div>
        <p className="method-note">{t.imagePrivacy}</p>
      </div>
    </Modal>
  );
}
