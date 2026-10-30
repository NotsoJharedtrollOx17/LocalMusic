import {
  normalizeSearch,
  normalizeSearchName,
  normalizedSearchRank,
  searchTerms,
} from "./match";
let rows: Array<{ id: string; text: string; name: string }> = [];
self.onmessage = (
  event: MessageEvent<{
    id: number;
    rows?: Array<{ id: string; title: string; artist: string; album: string }>;
    query: string;
  }>,
) => {
  const { id, query } = event.data;
  try {
    if (event.data.rows)
      rows = event.data.rows.map((t) => ({
        id: t.id,
        name: normalizeSearchName(t.title),
        text: normalizeSearch(`${t.title} ${t.artist} ${t.album}`),
      }));
    const terms = searchTerms(query);
    const primaryQuery = terms.join(" ");
    self.postMessage({
      id,
      scores: rows
        .filter((row) => terms.every((term) => row.text.includes(term)))
        .map((row) => [row.id, normalizedSearchRank(row.name, primaryQuery)]),
    });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
