export const normalizeSearch = (value: string) =>
  value.normalize("NFKC").toLowerCase().trim();
export const searchTerms = (query: string) =>
  normalizeSearch(query).split(/\s+/).filter(Boolean);
export const matchesSearch = (value: string, query: string) => {
  const text = normalizeSearch(value);
  return searchTerms(query).every((term) => text.includes(term));
};
