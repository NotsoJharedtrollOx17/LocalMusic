export const normalizeSearch = (value: string) =>
  value.normalize("NFKC").toLowerCase().trim();
export const searchTerms = (query: string) =>
  normalizeSearch(query).split(/\s+/).filter(Boolean);
export const matchesSearch = (value: string, query: string) => {
  const text = normalizeSearch(value);
  return searchTerms(query).every((term) => text.includes(term));
};

export const normalizeSearchName = (value: string) =>
  searchTerms(value).join(" ");
export function normalizedSearchRank(name: string, query: string): number {
  if (!query || name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (query.split(" ").every((term) => name.includes(term))) return 2;
  return 3;
}
export const searchRank = (name: string, query: string) =>
  normalizedSearchRank(normalizeSearchName(name), normalizeSearchName(query));
