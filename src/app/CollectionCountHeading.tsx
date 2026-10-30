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
  const { t, settings, formatMusicCount, inlineSearch } = useMusicAppContext();
  const singular = {
    albums: t.albumSingular,
    artists: t.artistSingular,
    playlists: t.playlistSingular,
  };
  const formatCount = (count: number | null) =>
    count === null
      ? "\u00a0"
      : kind === "songs"
        ? formatMusicCount(count, true)
        : `${count.toLocaleString(settings?.language)} ${count === 1 ? singular[kind] : t[kind].toLocaleLowerCase(settings?.language)}`;
  const matching = inlineSearch.active ? inlineSearch.page : undefined;
  const shown = matching?.total ?? count;
  const text = matching
    ? t.searchHeadingCount
        .replace("{count}", matching.total.toLocaleString(settings?.language))
        .replace("{collection}", formatCount(matching.allTotal))
    : formatCount(shown);
  return (
    <h2
      className="collection-count"
      id={id}
      aria-busy={
        shown === null ||
        (inlineSearch.active &&
          (inlineSearch.pending || Boolean(inlineSearch.error)))
      }
      aria-label={shown === null ? t[kind] : undefined}
    >
      {shown !== null && prefix ? `${prefix} · ${text}` : text}
    </h2>
  );
}
