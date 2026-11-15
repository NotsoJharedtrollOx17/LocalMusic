export default function AboutContent({
  version,
  spanish,
}: {
  version: string;
  spanish: boolean;
}) {
  return (
    <div className="settings-form">
      <h2>Local Music {version}</h2>
      <p className="about-credit">
        {spanish ? "Creado por" : "Created by"} Abraham Jhared Flores Azcona
      </p>
      <p>
        {spanish
          ? "Tu música local, playlists y resúmenes de escucha. Sin cuenta ni servicios de streaming."
          : "Your local music, playlists and listening recaps. No account or streaming service required."}
      </p>
      <p>
        {spanish
          ? "Software libre bajo la licencia MIT. Los avisos de terceros se incluyen con la aplicación."
          : "Open source under the MIT license. Third-party notices are included with the application."}
      </p>
    </div>
  );
}
