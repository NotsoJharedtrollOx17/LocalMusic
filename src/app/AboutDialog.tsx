import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { version as previewVersion } from "../../package.json";
import { native } from "../api";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import AboutContent from "./AboutContent";

export default function AboutDialog() {
  const { modal, setModal, settings, t } = useMusicAppContext();
  const [version, setVersion] = useState(""),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (modal !== "about") return;
    let active = true;
    setError("");
    setVersion("");
    void (native ? getVersion() : Promise.resolve(previewVersion)).then(
      (value) => {
        if (active) setVersion(value);
      },
      (reason) => {
        if (active) setError(String(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [modal, attempt]);
  if (modal !== "about") return null;
  return (
    <Modal
      title={t.aboutApp}
      closeLabel={t.close}
      onClose={() => {
        setModal(null);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>("[data-about-origin]")
            ?.focus({ preventScroll: true }),
        );
      }}
    >
      {version ? (
        <AboutContent version={version} spanish={settings?.language === "es"} />
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          <button
            className="button secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <p role="status">{t.loading}</p>
      )}
    </Modal>
  );
}
