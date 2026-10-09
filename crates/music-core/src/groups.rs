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
impl Store {
    pub fn group_ids(&self, kind: &str, title: &str, subtitle: &str) -> Result<Vec<String>, String> {
        let predicate = match kind {
            "artists" => "artist = ?1",
            "albums" => "album = ?1 AND artist = ?2",
            _ => return Err("Invalid library section".into()),
        };
        let sql = format!("SELECT id FROM tracks WHERE {predicate} ORDER BY title COLLATE NOCASE, id");
        let mut statement = self.connection.prepare(&sql).map_err(|e| e.to_string())?;
        let values = if kind == "artists" { vec![title] } else { vec![title, subtitle] };
        let rows = statement.query_map(rusqlite::params_from_iter(values), |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
    }
    pub fn groups(&self, kind: &str, offset: usize, limit: usize) -> Result<GroupPage, String> {
        let (title, subtitle, where_clause, group) = match kind {
            "albums" => ("album", "artist", "TRIM(album)<>''", "artist,album"),
            "artists" => ("artist", "''", "TRIM(artist)<>''", "artist"),
            _ => return Err("Invalid library section".into()),
        };
        let count = format!(
            "SELECT COUNT(*) FROM (SELECT 1 FROM tracks WHERE {where_clause} GROUP BY {group})"
        );
        let total = self
            .connection
            .query_row(&count, [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let sql=format!("SELECT {title},{subtitle},json_group_array(id),MIN(id) FROM tracks WHERE {where_clause} GROUP BY {group} ORDER BY {title} COLLATE NOCASE LIMIT ?1 OFFSET ?2");
        let mut st = self.connection.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = st
            .query_map(params![limit.min(60), offset], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        let mut groups = Vec::new();
        for row in rows {
            let (title, subtitle, raw, id) = row.map_err(|e| e.to_string())?;
            groups.push(CatalogGroup {
                title,
                subtitle,
                ids: serde_json::from_str(&raw).map_err(|e| e.to_string())?,
                track: self.track(&id)?.ok_or("Invalid group representative")?,
            });
        }
        Ok(GroupPage { groups, total })
    }
}
