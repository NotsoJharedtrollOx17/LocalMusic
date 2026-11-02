use crate::*;
impl Store {
    pub fn tracks_with_options(
        &self,
        query: &str,
        offset: usize,
        limit: usize,
        favorite_only: bool,
        sort: &str,
    ) -> Result<LibraryPage, String> {
        if !["title", "artist", "album"].contains(&sort) {
            return Err("Invalid sort order".into());
        }
        let matches = if query.trim().is_empty() {
            None
        } else {
            Some(self.matching_track_scores(query)?)
        };
        let mut tracks = self
            .all_tracks()?
            .into_iter()
            .filter(|t| {
                !t.hidden
                    && (!favorite_only || t.favorite)
                    && matches.as_ref().is_none_or(|m| m.contains_key(&t.id))
            })
            .collect::<Vec<_>>();
        tracks.sort_by(|a, b| {
            let rank = matches
                .as_ref()
                .map_or(std::cmp::Ordering::Equal, |m| m[&a.id].cmp(&m[&b.id]));
            rank.then_with(|| match sort {
                "artist" => identity::norm(&identity::lead(a))
                    .cmp(&identity::norm(&identity::lead(b)))
                    .then(
                        identity::norm(&identity::album(a).title)
                            .cmp(&identity::norm(&identity::album(b).title)),
                    )
                    .then(groups::track_order(a, b)),
                "album" => identity::norm(&identity::album(a).title)
                    .cmp(&identity::norm(&identity::album(b).title))
                    .then(
                        identity::norm(&identity::album(a).artist)
                            .cmp(&identity::norm(&identity::album(b).artist)),
                    )
                    .then(groups::track_order(a, b)),
                _ => identity::norm(&a.title)
                    .cmp(&identity::norm(&b.title))
                    .then(a.id.cmp(&b.id)),
            })
        });
        let total = tracks.len();
        Ok(LibraryPage {
            tracks: tracks
                .into_iter()
                .skip(offset)
                .take(limit.min(100))
                .collect(),
            total,
        })
    }
}
