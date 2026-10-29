use crate::*;
use rusqlite::params;
impl Store {
    pub fn tracks_with_options(
        &self,
        query: &str,
        offset: usize,
        limit: usize,
        favorite_only: bool,
        sort: &str,
    ) -> Result<LibraryPage, String> {
        let order = match sort {
            "title" => "title COLLATE NOCASE,id".to_string(),
            "artist" => format!(
                "artist COLLATE NOCASE,album COLLATE NOCASE,{}",
                groups::ALBUM_TRACK_ORDER
            ),
            "album" => format!(
                "album COLLATE NOCASE,artist COLLATE NOCASE,{}",
                groups::ALBUM_TRACK_ORDER
            ),
            _ => return Err("Invalid sort order".into()),
        };
        let ids = if query.trim().is_empty() {
            None
        } else {
            Some(
                serde_json::to_string(&self.matching_track_ids(query)?)
                    .map_err(|e| e.to_string())?,
            )
        };
        let q = ids.unwrap_or_default();
        let predicate="id NOT IN (SELECT track_id FROM hidden_tracks) AND (?4=0 OR json_extract(data,'$.favorite')=1) AND (?1='' OR id IN (SELECT value FROM json_each(?1)))";
        let total = self
            .connection
            .query_row(
                &format!("SELECT COUNT(*) FROM tracks WHERE {predicate}"),
                params![q, limit.min(100), offset, favorite_only],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let mut st = self
            .connection
            .prepare(&format!(
                "SELECT data FROM tracks WHERE {predicate} ORDER BY {order} LIMIT ?2 OFFSET ?3"
            ))
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map(params![q, limit.min(100), offset, favorite_only], |r| {
                r.get::<_, String>(0)
            })
            .map_err(|e| e.to_string())?;
        let mut tracks = Vec::new();
        for row in rows {
            tracks.push(
                serde_json::from_str(&row.map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?,
            );
        }
        Ok(LibraryPage { tracks, total })
    }
}
