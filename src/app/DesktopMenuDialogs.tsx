import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function DesktopMenuDialogs() {
  const { modal, setModal, t, settings, desktopMenu } = useMusicAppContext();
  const es = settings?.language === "es";
  if (modal !== "help" && modal !== "about") return null;
  const title =
    modal === "help"
      ? es
        ? "Ayuda y atajos de teclado"
        : "Help and keyboard shortcuts"
      : es
        ? "Acerca de Local Music"
        : "About Local Music";
  return (
    <Modal title={title} closeLabel={t.close} onClose={() => setModal(null)}>
      {modal === "about" ? (
        <div className="settings-form">
          <h3>Local Music {desktopMenu.version}</h3>
          <p>
            {es
              ? "Tu música local, playlists y resúmenes de escucha. Sin cuenta ni servicios de streaming."
              : "Your local music, playlists and listening recaps. No account or streaming service required."}
          </p>
          <p>
            {es
              ? "Software libre bajo la licencia MIT. Los avisos de terceros se incluyen con la aplicación."
              : "Open source under the MIT license. Third-party notices are included with the application."}
          </p>
        </div>
      ) : (
        <div className="settings-form">
          <section>
            <h3>{es ? "Tu biblioteca" : "Your library"}</h3>
            <p>
              {es
                ? "Importa una carpeta con música desde Archivo. Busca en la vista actual; la X borra el filtro. Crea una playlist vacía desde Archivo o genera una mezcla desde Playlists."
                : "Import a music folder from File. Search filters the current view; X clears the filter. Create an empty playlist from File or generate a mix in Playlists."}
            </p>
          </section>
          <section>
            <h3>{es ? "Reproducción y ventanas" : "Playback and windows"}</h3>
            <p>
              {es
                ? "Ventana abre Reproduciendo, Cola, Visualizador y Ecualizador. Cerrar una ventana independiente no detiene la música. Volver a la ventana principal restaura la vista dentro de la aplicación."
                : "Window opens Now Playing, Queue, Visualizer and Equalizer. Closing a separate window keeps music playing. Return to main window restores its view inside the app."}
            </p>
          </section>
          <section>
            <h3>{es ? "Tu resumen y privacidad" : "Your Recap and privacy"}</h3>
            <p>
              {es
                ? "Tu resumen muestra solo la escucha registrada en esta aplicación. Un play cuenta a los 30 segundos. Excluir del resumen está en el menú de la canción; los controles de historial están en Ajustes."
                : "Your Recap shows only listening recorded in this app. A play counts after 30 seconds. Exclude from recap is in the song menu; history controls are in Settings."}
            </p>
          </section>
          <section>
            <h3>{es ? "Atajos de teclado" : "Keyboard shortcuts"}</h3>
            <dl>
              <dt>Ctrl+O</dt>
              <dd>{es ? "Importar música" : "Import music"}</dd>
              <dt>Ctrl+N</dt>
              <dd>{t.newPlaylist}</dd>
              <dt>Ctrl+F / /</dt>
              <dd>
                {es
                  ? "Buscar en esta vista (fuera de Tu resumen)"
                  : "Search this view (outside Your Recap)"}
              </dd>
              <dt>Ctrl+,</dt>
              <dd>{t.settings}</dd>
              <dt>{es ? "Espacio" : "Space"}</dt>
              <dd>
                {es
                  ? "Reproducir/pausar fuera de campos y botones"
                  : "Play/pause outside text fields and buttons"}
              </dd>
              <dt>Escape</dt>
              <dd>
                {es
                  ? "Cerrar la capa actual; en búsqueda, borrar y luego cerrar"
                  : "Close the current layer; in search, clear then close"}
              </dd>
              <dt>Alt / F10</dt>
              <dd>
                {es ? "Activar la barra de menús" : "Activate the menu bar"}
              </dd>
              <dt>Alt+F4</dt>
              <dd>
                {es ? "Cerrar la ventana actual" : "Close the current window"}
              </dd>
            </dl>
          </section>
        </div>
      )}
    </Modal>
  );
}
