use crate::*;

/// Literal AND-of-substrings matching shared by all scoped search surfaces.
pub fn matches(value: &str, query: &str) -> bool {
    let value = normalize(value);
    normalize(query)
        .split_whitespace()
        .all(|term| value.contains(term))
}
impl Store {
    pub fn matching_track_ids(&self, query: &str) -> Result<Vec<String>, String> {
        let revision = self.catalog_revision.get();
        let mut cache = self.search_cache.borrow_mut();
        if cache.as_ref().map(|x| x.0) != Some(revision) {
            *cache = Some((
                revision,
                self.all_tracks()?
                    .into_iter()
                    .filter(|t| !t.hidden)
                    .map(|t| {
                        (
                            t.id,
                            normalize(&format!("{} {} {}", t.title, t.artist, t.album)),
                        )
                    })
                    .collect(),
            ));
        }
        let terms = normalize(query);
        Ok(cache
            .as_ref()
            .unwrap()
            .1
            .iter()
            .filter(|(_, text)| terms.split_whitespace().all(|term| text.contains(term)))
            .map(|(id, _)| id.clone())
            .collect())
    }
    pub fn filter_track_ids(&self, ids: &[String], query: &str) -> Result<Vec<String>, String> {
        let matching = self
            .matching_track_ids(query)?
            .into_iter()
            .collect::<std::collections::HashSet<_>>();
        Ok(ids
            .iter()
            .filter(|id| matching.contains(*id))
            .cloned()
            .collect())
    }
}
