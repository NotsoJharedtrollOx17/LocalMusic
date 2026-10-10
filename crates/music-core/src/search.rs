use crate::groups::CatalogGroup;
use crate::*;
use serde::Serialize;

#[derive(Serialize)]
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<CatalogGroup>,
    pub artists: Vec<CatalogGroup>,
    pub playlists: Vec<Playlist>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}
impl Store {
    pub fn search_catalog(&self, query: &str) -> Result<SearchResults, String> {
        self.search_catalog_limit(query, 30)
    }
    pub fn search_catalog_limit(&self, query: &str, limit: usize) -> Result<SearchResults, String> {
        let limit = limit.max(1);
        let query = normalize(query);
        let matches = |value: &str| {
            query
                .split_whitespace()
                .all(|term| normalize(value).contains(term))
        };
        let mut tracks: Vec<_> = self
            .all_tracks()?
            .into_iter()
            .filter(|t| !t.hidden && matches(&format!("{} {} {}", t.title, t.artist, t.album)))
            .collect();
        tracks.sort_by(|a, b| {
            normalize(&a.title)
                .cmp(&normalize(&b.title))
                .then(a.id.cmp(&b.id))
        });
        let find_groups = |kind: &str| -> Result<Vec<CatalogGroup>, String> {
            let mut result = Vec::new();
            let mut offset = 0;
            loop {
                let page = self.groups(kind, offset, 60)?;
                offset += page.groups.len();
                result.extend(
                    page.groups
                        .into_iter()
                        .filter(|g| matches(&format!("{} {}", g.title, g.subtitle))),
                );
                if result.len() > limit || offset >= page.total {
                    break;
                }
            }
            Ok(result)
        };
        let mut playlists: Vec<_> = self
            .playlists()?
            .into_iter()
            .filter(|p| matches(&p.title))
            .collect();
        let mut albums = find_groups("albums")?;
        let mut artists = find_groups("artists")?;
        let has_more = [
            &tracks.len(),
            &albums.len(),
            &artists.len(),
            &playlists.len(),
        ]
        .into_iter()
        .any(|n| *n > limit);
        tracks.truncate(limit);
        albums.truncate(limit);
        artists.truncate(limit);
        playlists.truncate(limit);
        Ok(SearchResults {
            tracks,
            albums,
            artists,
            playlists,
            has_more,
        })
    }
}
