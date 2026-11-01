import { useMusicAppContext } from "./MusicAppContext";
export default function DesktopMenuFeedback() {
  const { desktopMenu, settings, t } = useMusicAppContext();
  if (!desktopMenu.error) return null;
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>
          {settings?.language === "es"
            ? "No se pudo actualizar la barra de menús"
            : "Could not update the menu bar"}
        </strong>
        <span>{desktopMenu.error}</span>
      </div>
      <button className="button secondary" onClick={desktopMenu.retry}>
        {t.retry}
      </button>
    </div>
  );
}
