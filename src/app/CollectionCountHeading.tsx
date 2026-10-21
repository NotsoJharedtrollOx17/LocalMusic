import { useMusicAppContext } from "./MusicAppContext";

export default function CollectionCountHeading({
  kind,
  count,
  prefix,
  id,
}: {
  kind: "songs" | "albums" | "artists" | "playlists";
  count: number | null;
  prefix?: string;
  id?: string;
}) {
  const { t, settings, formatMusicCount } = useMusicAppContext();
  const singular = {
    albums: t.albumSingular,
    artists: t.artistSingular,
    playlists: t.playlistSingular,
  };
  const text =
    count === null
      ? "\u00a0"
      : kind === "songs"
        ? formatMusicCount(count, true)
        : `${count.toLocaleString(settings?.language)} ${count === 1 ? singular[kind] : t[kind].toLocaleLowerCase(settings?.language)}`;
  return (
    <h2
      className="collection-count"
      id={id}
      aria-busy={count === null}
      aria-label={count === null ? t[kind] : undefined}
    >
      {count !== null && prefix ? `${prefix} · ${text}` : text}
    </h2>
  );
}
