import { normalizeSearch, searchTerms } from "./match";
let rows: Array<{ id: string; text: string }> = [];
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
        text: normalizeSearch(`${t.title} ${t.artist} ${t.album}`),
      }));
    const terms = searchTerms(query);
    self.postMessage({
      id,
      ids: rows
        .filter((row) => terms.every((term) => row.text.includes(term)))
        .map((row) => row.id),
    });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
