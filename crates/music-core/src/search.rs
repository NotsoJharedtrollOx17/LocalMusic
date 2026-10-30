use crate::*;

/// Literal AND-of-substrings matching shared by all scoped search surfaces.
pub fn matches(value: &str, query: &str) -> bool {
    let value = normalize(value);
    normalize(query)
        .split_whitespace()
        .all(|term| value.contains(term))
}
pub(crate) fn primary_name(value: &str) -> String {
    normalize(value)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
pub(crate) fn normalized_relevance(name: &str, query: &str) -> u8 {
    if query.is_empty() || name == query {
        0
    } else if name.starts_with(query) {
        1
    } else if query.split(' ').all(|term| name.contains(term)) {
        2
    } else {
        3
    }
}
pub fn relevance(name: &str, query: &str) -> u8 {
    normalized_relevance(&primary_name(name), &primary_name(query))
}
impl Store {
    pub fn matching_track_scores(
        &self,
        query: &str,
    ) -> Result<std::collections::BTreeMap<String, u8>, String> {
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
                            primary_name(&t.title),
                        )
                    })
                    .collect(),
            ));
        }
        let terms = normalize(query);
        let primary_query = primary_name(query);
        Ok(cache
            .as_ref()
            .unwrap()
            .1
            .iter()
            .filter(|(_, text, _)| terms.split_whitespace().all(|term| text.contains(term)))
            .map(|(id, _, name)| (id.clone(), normalized_relevance(name, &primary_query)))
            .collect())
    }
    pub fn matching_track_ids(&self, query: &str) -> Result<Vec<String>, String> {
        Ok(self.matching_track_scores(query)?.into_keys().collect())
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
