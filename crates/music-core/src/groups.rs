use crate::*;
use rusqlite::params;
use serde::Serialize;
#[derive(Clone, Serialize)]
pub struct CatalogGroup {
    pub title: String,
    pub subtitle: String,
    pub ids: Vec<String>,
    pub track: Track,
}
#[derive(Serialize)]
pub struct GroupPage {
    pub groups: Vec<CatalogGroup>,
    pub total: usize,
}
pub(crate) const ALBUM_TRACK_ORDER: &str = "COALESCE(NULLIF(json_extract(data,'$.discNumber'),0),1),COALESCE(NULLIF(json_extract(data,'$.trackNumber'),0),4294967296),title COLLATE NOCASE,id";
impl Store {
    pub fn group_ids(
        &self,
        kind: &str,
        title: &str,
        subtitle: &str,
    ) -> Result<Vec<String>, String> {
        let predicate = match kind {
            "artists" => "artist = ?1",
            "albums" => "album = ?1 AND artist = ?2",
            _ => return Err("Invalid library section".into()),
        };
        let order = if kind == "artists" {
            format!("album COLLATE NOCASE,{ALBUM_TRACK_ORDER}")
        } else {
            ALBUM_TRACK_ORDER.to_string()
        };
        let sql = format!("SELECT id FROM tracks WHERE id NOT IN (SELECT track_id FROM hidden_tracks) AND {predicate} ORDER BY {order}");
        let mut statement = self.connection.prepare(&sql).map_err(|e| e.to_string())?;
        let values = if kind == "artists" {
            vec![title]
        } else {
            vec![title, subtitle]
        };
        let rows = statement
            .query_map(rusqlite::params_from_iter(values), |row| {
                row.get::<_, String>(0)
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())
    }
    pub fn groups(&self, kind: &str, offset: usize, limit: usize) -> Result<GroupPage, String> {
        let (title, subtitle, where_clause, group) = match kind {
            "albums" => ("album", "artist", "TRIM(album)<>''", "artist,album"),
            "artists" => ("artist", "''", "TRIM(artist)<>''", "artist"),
            _ => return Err("Invalid library section".into()),
        };
        let count = format!(
            "SELECT COUNT(*) FROM (SELECT 1 FROM tracks WHERE id NOT IN (SELECT track_id FROM hidden_tracks) AND {where_clause} GROUP BY {group})"
        );
        let total = self
            .connection
            .query_row(&count, [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let sql=format!("SELECT {title},{subtitle} FROM tracks WHERE id NOT IN (SELECT track_id FROM hidden_tracks) AND {where_clause} GROUP BY {group} ORDER BY {title} COLLATE NOCASE LIMIT ?1 OFFSET ?2");
        let mut st = self.connection.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = st
            .query_map(params![limit.min(60), offset], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut groups = Vec::new();
        for row in rows {
            let (title, subtitle) = row.map_err(|e| e.to_string())?;
            let ids = self.group_ids(kind, &title, &subtitle)?;
            groups.push(CatalogGroup {
                track: self
                    .track(ids.first().ok_or("Invalid empty group")?)?
                    .ok_or("Invalid group representative")?,
                title,
                subtitle,
                ids,
            });
        }
        Ok(GroupPage { groups, total })
    }
}
