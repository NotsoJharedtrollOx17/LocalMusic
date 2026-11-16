use crate::identity::{album, album_artist, lead, norm, opaque, unique};
use crate::*;
use serde::Serialize;
use std::collections::BTreeMap;
#[derive(Clone, Serialize)]
pub struct CatalogGroup {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub ids: Vec<String>,
    pub track: Track,
    pub aliases: Vec<String>,
}
#[derive(Serialize)]
pub struct GroupPage {
    pub groups: Vec<CatalogGroup>,
    pub total: usize,
}
pub fn track_order(a: &Track, b: &Track) -> std::cmp::Ordering {
    a.disc_number
        .unwrap_or(1)
        .cmp(&b.disc_number.unwrap_or(1))
        .then(
            a.track_number
                .unwrap_or(u32::MAX)
                .cmp(&b.track_number.unwrap_or(u32::MAX)),
        )
        .then(norm(&a.title).cmp(&norm(&b.title)))
        .then(a.id.cmp(&b.id))
}
pub fn collect_groups(kind: &str, tracks: &[Track]) -> Result<Vec<CatalogGroup>, String> {
    if !["albums", "artists"].contains(&kind) {
        return Err("Invalid library section".into());
    }
    let mut entries: BTreeMap<String, Vec<&Track>> = BTreeMap::new();
    for t in tracks.iter().filter(|t| !t.hidden) {
        let title = if kind == "albums" {
            album(t).title
        } else {
            lead(t)
        };
        if title.trim().is_empty() {
            continue;
        }
        let id = if kind == "albums" {
            album(t).id
        } else {
            opaque("artist:", &norm(&title))
        };
        entries.entry(id).or_default().push(t);
    }
    let mut groups = vec![];
    for (id, mut ts) in entries {
        ts.sort_by(|a, b| {
            if kind == "artists" {
                norm(&album(a).title)
                    .cmp(&norm(&album(b).title))
                    .then(track_order(a, b))
            } else {
                track_order(a, b)
            }
        });
        let first = ts[0];
        let label = album(first);
        let mut selected = if kind == "albums" {
            unique(ts.clone())
        } else {
            ts.clone()
        };
        selected.sort_by(|a, b| {
            if kind == "artists" {
                norm(&album(a).title)
                    .cmp(&norm(&album(b).title))
                    .then(track_order(a, b))
            } else {
                track_order(a, b)
            }
        });
        let cover = if kind == "albums" {
            ts.iter()
                .find(|t| t.id == label.cover_id)
                .copied()
                .unwrap_or(first)
        } else {
            first
        };
        let mut aliases = ts
            .iter()
            .map(|t| {
                if kind == "albums" {
                    format!("{} {}", t.album, album_artist(t))
                } else {
                    format!("{} {}", t.artist, t.identity.artist_names.join(" "))
                }
            })
            .collect::<Vec<_>>();
        aliases.sort();
        aliases.dedup();
        groups.push(CatalogGroup {
            id,
            title: if kind == "albums" {
                label.title
            } else {
                lead(first)
            },
            subtitle: if kind == "albums" {
                label.artist
            } else {
                String::new()
            },
            ids: selected.iter().map(|t| t.id.clone()).collect(),
            track: cover.clone(),
            aliases,
        });
    }
    groups.sort_by(|a, b| {
        norm(&a.title)
            .cmp(&norm(&b.title))
            .then(norm(&a.subtitle).cmp(&norm(&b.subtitle)))
            .then(a.id.cmp(&b.id))
    });
    Ok(groups)
}
impl Store {
    pub fn group_ids(
        &self,
        kind: &str,
        title: &str,
        subtitle: &str,
    ) -> Result<Vec<String>, String> {
        self.group_ids_by_id(kind, title, subtitle, None)
    }
    pub fn group_ids_by_id(
        &self,
        kind: &str,
        title: &str,
        subtitle: &str,
        id: Option<&str>,
    ) -> Result<Vec<String>, String> {
        Ok(self
            .catalog_groups(kind)?
            .into_iter()
            .find(|g| {
                if let Some(id) = id {
                    g.id == id
                } else {
                    g.title == title && (kind == "artists" || g.subtitle == subtitle)
                }
            })
            .map(|g| g.ids)
            .unwrap_or_default())
    }
    pub(crate) fn catalog_groups(&self, kind: &str) -> Result<Vec<CatalogGroup>, String> {
        let rev = self.catalog_revision.get();
        let mut cache = self.identity_group_cache.borrow_mut();
        if cache.get(kind).map(|(r, _)| *r) != Some(rev) {
            cache.insert(
                kind.into(),
                (rev, collect_groups(kind, &self.all_tracks()?)?),
            );
        }
        Ok(cache[kind].1.clone())
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
        let mut groups = self
            .catalog_groups(kind)?
            .into_iter()
            .filter(|g| {
                search::matches(
                    &format!("{} {} {}", g.title, g.subtitle, g.aliases.join(" ")),
                    query,
                )
            })
            .collect::<Vec<_>>();
        groups.sort_by_key(|g| search::relevance(&g.title, query));
        let total = groups.len();
        Ok(GroupPage {
            groups: groups
                .into_iter()
                .skip(offset)
                .take(limit.min(1_000_000))
                .collect(),
            total,
        })
    }
}
