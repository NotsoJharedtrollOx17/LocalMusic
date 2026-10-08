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
            "title" => "title",
            "artist" => "artist",
            "album" => "album",
            _ => return Err("Invalid sort order".into()),
        };
        let q = query
            .split_whitespace()
            .map(|s| format!("\"{}\"*", s.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" AND ");
        let predicate="(?4=0 OR json_extract(data,'$.favorite')=1) AND (?1='' OR id IN (SELECT id FROM tracks_fts WHERE tracks_fts MATCH ?1))";
        let total = self
            .connection
            .query_row(
                &format!("SELECT COUNT(*) FROM tracks WHERE {predicate}"),
                params![q, limit.min(100), offset, favorite_only],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let mut st=self.connection.prepare(&format!("SELECT data FROM tracks WHERE {predicate} ORDER BY {order} COLLATE NOCASE,title COLLATE NOCASE,id LIMIT ?2 OFFSET ?3")).map_err(|e|e.to_string())?;
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
