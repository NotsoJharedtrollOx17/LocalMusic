use crate::*;
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
        let cache_key =
            serde_json::to_string(&(kind, title, subtitle)).map_err(|e| e.to_string())?;
        let revision = self.catalog_revision.get();
        if let Some((saved_revision, ids)) = self.membership_cache.borrow().get(&cache_key) {
            if *saved_revision == revision {
                return Ok(ids.clone());
            }
        }
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
        let ids = rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?;
        let mut cache = self.membership_cache.borrow_mut();
        cache.insert(cache_key, (revision, ids.clone()));
        if cache.len() > 128 {
            let first = cache.keys().next().cloned().unwrap();
            cache.remove(&first);
        }
        Ok(ids)
    }

    pub fn groups(&self, kind: &str, offset: usize, limit: usize) -> Result<GroupPage, String> {
        self.groups_filtered(kind, offset, limit, "")
    }
    pub fn groups_filtered(
        &self,
        kind: &str,
        offset: usize,
        limit: usize,
        query: &str,
    ) -> Result<GroupPage, String> {
        let (title, subtitle, where_clause, group) = match kind {
            "albums" => ("album", "artist", "TRIM(album)<>''", "artist,album"),
            "artists" => ("artist", "''", "TRIM(artist)<>''", "artist"),
            _ => return Err("Invalid library section".into()),
        };
        let revision = self.catalog_revision.get();
        let mut cache = self.group_search_cache.borrow_mut();
        if cache.get(kind).map(|x| x.0) != Some(revision) {
            let sql = format!("SELECT {title},{subtitle} FROM tracks WHERE id NOT IN (SELECT track_id FROM hidden_tracks) AND {where_clause} GROUP BY {group} ORDER BY {title} COLLATE NOCASE,{subtitle} COLLATE NOCASE");
            let mut statement = self.connection.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = statement
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
                .map_err(|e| e.to_string())?;
            let labels = rows
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|e| e.to_string())?
                .into_iter()
                .map(|(title, subtitle)| {
                    let text = normalize(&format!("{title} {subtitle}"));
                    {
                        let name = search::primary_name(&title);
                        (title, subtitle, text, name)
                    }
                })
                .collect::<Vec<_>>();
            cache.insert(kind.into(), (revision, labels));
        }
        let query = normalize(query);
        let terms = query.split_whitespace().collect::<Vec<_>>();
        let mut labels = cache[kind]
            .1
            .iter()
            .filter(|(_, _, text, _)| terms.iter().all(|term| text.contains(term)))
            .collect::<Vec<_>>();
        let primary_query = search::primary_name(&query);
        labels.sort_by_key(|(_, _, _, name)| search::normalized_relevance(name, &primary_query));
        let total = labels.len();
        let mut groups = Vec::new();
        for (title, subtitle, _, _) in labels.into_iter().skip(offset).take(limit.min(60)) {
            let ids = self.group_ids(kind, &title, &subtitle)?;
            groups.push(CatalogGroup {
                track: self
                    .track(ids.first().ok_or("Invalid empty group")?)?
                    .ok_or("Invalid group representative")?,
                title: title.clone(),
                subtitle: subtitle.clone(),
                ids,
            });
        }
        Ok(GroupPage { groups, total })
    }
}
