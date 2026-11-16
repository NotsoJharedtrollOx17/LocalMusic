use crate::{groups::CatalogGroup, Store, Track};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexGroup {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub ids: Vec<String>,
    pub aliases: Vec<String>,
    pub cover_track_id: String,
}
impl From<CatalogGroup> for IndexGroup {
    fn from(g: CatalogGroup) -> Self {
        Self {
            id: g.id,
            title: g.title,
            subtitle: g.subtitle,
            ids: g.ids,
            aliases: g.aliases,
            cover_track_id: g.track.id,
        }
    }
}
#[derive(Serialize)]
pub struct CatalogIndex {
    pub revision: u64,
    pub tracks: Vec<Track>,
    pub albums: Vec<IndexGroup>,
    pub artists: Vec<IndexGroup>,
}
impl Store {
    /// Caller holds the Store mutex throughout. Never resolve artwork or open audio.
    pub fn catalog_index(&self) -> Result<CatalogIndex, String> {
        let mut tracks: Vec<_> = self
            .all_tracks()?
            .into_iter()
            .filter(|t| !t.hidden)
            .collect();
        tracks.sort_by(|a, b| {
            crate::identity::norm(&a.title)
                .cmp(&crate::identity::norm(&b.title))
                .then(a.id.cmp(&b.id))
        });
        for track in &mut tracks {
            track.source_uri.clear();
            // Only cache identities cross IPC, never embedded/base64 artwork.
            if !track
                .artwork_url
                .as_deref()
                .is_some_and(|s| s.starts_with("cache:"))
            {
                track.artwork_url = None;
            }
        }
        Ok(CatalogIndex {
            revision: self.catalog_version(),
            tracks,
            albums: self
                .catalog_groups("albums")?
                .into_iter()
                .map(Into::into)
                .collect(),
            artists: self
                .catalog_groups("artists")?
                .into_iter()
                .map(Into::into)
                .collect(),
        })
    }
}
