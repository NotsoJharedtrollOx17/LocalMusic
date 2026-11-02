use crate::{normalize, Store, Track};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackIdentity {
    #[serde(default)]
    pub source_album_id: Option<String>,
    #[serde(default)]
    pub artist_names: Vec<String>,
    #[serde(default)]
    pub album_artist: Option<String>,
    #[serde(default)]
    pub identity_metadata_read: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_artist: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub song_identity: Option<String>,
    #[serde(default)]
    pub preferred_copy: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub album_identity: Option<AlbumIdentity>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumIdentity {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub cover_id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SongLink {
    pub id: String,
    pub ids: Vec<String>,
    pub preferred: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumLink {
    pub id: String,
    pub keys: Vec<String>,
    pub title: String,
    pub artist: String,
    pub cover_id: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Organization {
    pub revision: u64,
    pub artists: BTreeMap<String, String>,
    pub songs: Vec<SongLink>,
    pub albums: Vec<AlbumLink>,
    pub dismissed: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationSnapshot {
    pub state: Organization,
    pub tracks: Vec<Track>,
    pub song_candidates: Vec<Candidate>,
    pub album_candidates: Vec<Candidate>,
}
pub fn norm(s: &str) -> String {
    normalize(s)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
pub fn opaque(prefix: &str, s: &str) -> String {
    let mut h = 14695981039346656037u64;
    for b in s.as_bytes() {
        h = (h ^ (*b as u64)).wrapping_mul(1099511628211);
    }
    format!("{prefix}{h:016x}")
}
pub fn lead(t: &Track) -> String {
    if let Some(s) = &t.identity.primary_artist {
        return s.clone();
    }
    if let Some(s) = t
        .identity
        .artist_names
        .iter()
        .find(|s| !s.trim().is_empty())
    {
        return s.trim().into();
    }
    let words = t.artist.split_whitespace().collect::<Vec<_>>();
    let mut offset = 0;
    for (i, w) in words.iter().enumerate() {
        let begin = offset + t.artist[offset..].find(w).unwrap_or(0);
        offset = begin + w.len();
        if i > 0
            && i + 1 < words.len()
            && ["feat", "feat.", "ft", "ft.", "featuring"].contains(&w.to_lowercase().as_str())
        {
            return t.artist[..begin].trim().into();
        }
    }
    t.artist.trim().into()
}
pub fn song_key(t: &Track) -> &str {
    t.identity.song_identity.as_deref().unwrap_or(&t.id)
}
pub fn album_artist(t: &Track) -> String {
    t.identity
        .album_artist
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().into())
        .unwrap_or_else(|| lead(t))
}
pub fn default_album(t: &Track) -> String {
    opaque(
        "album:",
        &serde_json::to_string(&(norm(&album_artist(t)), norm(&t.album))).unwrap(),
    )
}
pub fn base_album(t: &Track) -> String {
    t.identity
        .source_album_id
        .clone()
        .unwrap_or_else(|| default_album(t))
}
pub fn album(t: &Track) -> AlbumIdentity {
    t.identity
        .album_identity
        .clone()
        .unwrap_or_else(|| AlbumIdentity {
            id: default_album(t),
            title: t.album.clone(),
            artist: album_artist(t),
            cover_id: t.id.clone(),
        })
}
impl Organization {
    pub fn apply(&self, mut t: Track) -> Track {
        t.identity.primary_artist = None;
        t.identity.song_identity = None;
        t.identity.album_identity = None;
        t.identity.preferred_copy = false;
        t.identity.source_album_id = Some(base_album(&t));
        t.identity.primary_artist =
            Some(self.artists.get(&t.id).cloned().unwrap_or_else(|| lead(&t)));
        if let Some(g) = self.songs.iter().find(|g| g.ids.contains(&t.id)) {
            t.identity.song_identity = Some(g.id.clone());
            t.identity.preferred_copy = g.preferred == t.id;
        }
        if let Some(g) = self
            .albums
            .iter()
            .find(|g| g.keys.contains(&base_album(&t)))
        {
            t.identity.album_identity = Some(AlbumIdentity {
                id: g.id.clone(),
                title: g.title.clone(),
                artist: g.artist.clone(),
                cover_id: g.cover_id.clone(),
            });
        }
        t
    }
}
pub fn unique<'a>(tracks: impl IntoIterator<Item = &'a Track>) -> Vec<&'a Track> {
    let mut positions: BTreeMap<&str, usize> = BTreeMap::new();
    let mut out: Vec<&Track> = vec![];
    for t in tracks {
        let k = song_key(t);
        if let Some(&i) = positions.get(k) {
            let old = out[i];
            if (t.available && !t.hidden) && !(old.available && !old.hidden)
                || (t.available && !t.hidden) == (old.available && !old.hidden)
                    && t.identity.preferred_copy
                    && !old.identity.preferred_copy
            {
                out[i] = t;
            }
        } else {
            positions.insert(k, out.len());
            out.push(t)
        }
    }
    out
}
impl Store {
    pub fn organization(&self) -> Result<Organization, String> {
        self.connection
            .query_row("SELECT data FROM library_identity WHERE id=1", [], |r| {
                r.get::<_, String>(0)
            })
            .map_err(|e| e.to_string())
            .and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
    }
    pub fn organization_snapshot(&self) -> Result<OrganizationSnapshot, String> {
        {
            let state = self.organization()?;
            let tracks = self
                .all_tracks()?
                .into_iter()
                .filter(|t| !t.hidden)
                .collect::<Vec<_>>();
            let (song_candidates, album_candidates) = candidates(&tracks, &state);
            Ok(OrganizationSnapshot {
                state,
                tracks,
                song_candidates,
                album_candidates,
            })
        }
    }
    pub fn organize_library(
        &mut self,
        revision: u64,
        a: serde_json::Value,
    ) -> Result<Organization, String> {
        let mut next = self.organization()?;
        if next.revision != revision {
            return Err("Library organization changed. Refresh and retry.".into());
        }
        let tracks = self.all_tracks()?;
        let known: BTreeSet<_> = tracks.iter().map(|t| t.id.clone()).collect();
        let strings = |key: &str| -> Result<Vec<String>, String> {
            serde_json::from_value(a[key].clone()).map_err(|_| format!("Invalid {key}"))
        };
        let text = |key: &str| -> Result<String, String> {
            let s = a[key].as_str().ok_or("Missing text")?.trim();
            if s.is_empty() || s.len() > 960 {
                return Err("Invalid organization label".into());
            }
            Ok(s.into())
        };
        match a["op"].as_str().ok_or("Missing organization action")? {
            "artist" => {
                let ids = strings("ids")?;
                if ids.is_empty() || ids.iter().any(|id| !known.contains(id)) {
                    return Err("Invalid tracks".into());
                }
                let name = if a["name"].is_null() {
                    None
                } else {
                    Some(text("name")?)
                };
                for id in ids {
                    if let Some(s) = &name {
                        next.artists.insert(id, s.clone());
                    } else {
                        next.artists.remove(&id);
                    }
                }
            }
            "songLink" => {
                let mut ids: BTreeSet<_> = strings("ids")?.into_iter().collect();
                for g in &next.songs {
                    if g.ids.iter().any(|id| ids.contains(id)) {
                        ids.extend(g.ids.clone());
                    }
                }
                let preferred = text("preferred")?;
                if ids.len() < 2 || !ids.contains(&preferred) || !ids.is_subset(&known) {
                    return Err("Invalid song link".into());
                }
                let id = next
                    .songs
                    .iter()
                    .find(|g| g.ids.iter().any(|id| ids.contains(id)))
                    .map(|g| g.id.clone())
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                next.songs
                    .retain(|g| !g.ids.iter().any(|id| ids.contains(id)));
                next.songs.push(SongLink {
                    id,
                    ids: ids.into_iter().collect(),
                    preferred,
                });
            }
            "songUnlink" => {
                let id = text("id")?;
                next.songs.retain(|g| g.id != id);
            }
            "albumLink" => {
                let mut keys: BTreeSet<_> = strings("keys")?.into_iter().collect();
                for g in &next.albums {
                    if g.keys.iter().any(|k| keys.contains(k)) {
                        keys.extend(g.keys.clone());
                    }
                }
                let valid: BTreeSet<_> = tracks
                    .iter()
                    .filter(|t| !t.album.trim().is_empty())
                    .map(base_album)
                    .collect();
                let title = text("title")?;
                let artist = text("artist")?;
                let cover_id = text("coverId")?;
                if keys.is_empty()
                    || !keys.is_subset(&valid)
                    || !tracks
                        .iter()
                        .any(|t| t.id == cover_id && keys.contains(&base_album(t)))
                {
                    return Err("Invalid album link".into());
                }
                let id = next
                    .albums
                    .iter()
                    .find(|g| g.keys.iter().any(|k| keys.contains(k)))
                    .map(|g| g.id.clone())
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                next.albums
                    .retain(|g| !g.keys.iter().any(|k| keys.contains(k)));
                next.albums.push(AlbumLink {
                    id,
                    keys: keys.into_iter().collect(),
                    title,
                    artist,
                    cover_id,
                });
            }
            "albumUnlink" => {
                let id = text("id")?;
                next.albums.retain(|g| g.id != id);
            }
            "dismiss" => {
                let signature = text("signature")?;
                if !next.dismissed.contains(&signature) {
                    next.dismissed.push(signature);
                }
                if next.dismissed.len() > 10000 {
                    next.dismissed.remove(0);
                }
            }
            _ => return Err("Unknown organization action".into()),
        }
        next.revision += 1;
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE library_identity SET data=?1 WHERE id=1",
            [serde_json::to_string(&next).map_err(|e| e.to_string())?],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        self.catalog_revision
            .set(self.catalog_revision.get().wrapping_add(1));
        Ok(next)
    }
}
#[derive(Serialize)]
pub struct Candidate {
    pub ids: [String; 2],
    pub signature: String,
}
pub fn candidate_song(a: &Track, b: &Track) -> bool {
    a.id != b.id
        && song_key(a) != song_key(b)
        && norm(&a.title) == norm(&b.title)
        && !norm(&lead(a)).is_empty()
        && norm(&lead(a)) == norm(&lead(b))
        && a.duration_ms > 0
        && b.duration_ms > 0
        && a.duration_ms.abs_diff(b.duration_ms) <= 2000
}
fn signature(kind: &str, a: &[&Track], b: &[&Track]) -> String {
    let sig = |ts: &[&Track]| {
        let mut values = ts
            .iter()
            .map(|t| {
                serde_json::to_string(&(
                    t.id.clone(),
                    t.title.clone(),
                    t.artist.clone(),
                    t.identity.artist_names.clone(),
                    t.identity.album_artist.clone(),
                    t.identity.primary_artist.clone(),
                    t.album.clone(),
                    t.duration_ms,
                ))
                .unwrap()
            })
            .collect::<Vec<_>>();
        values.sort();
        values.join("|")
    };
    let mut values = [sig(a), sig(b)];
    values.sort();
    opaque(&format!("{kind}:"), &values.join("::"))
}
fn edition(s: &str) -> String {
    let n = norm(s);
    let mut v = [
        "deluxe",
        "remastered",
        "remaster",
        "anniversary",
        "expanded",
        "live",
        "remix",
        "special edition",
    ]
    .iter()
    .filter(|w| {
        n.split(|c: char| !c.is_alphanumeric())
            .collect::<Vec<_>>()
            .windows(w.split(' ').count())
            .any(|words| words.join(" ") == **w)
    })
    .map(|s| s.to_string())
    .collect::<Vec<_>>();
    v.sort();
    v.join("|")
}
pub fn candidates(tracks: &[Track], state: &Organization) -> (Vec<Candidate>, Vec<Candidate>) {
    let mut songs = vec![];
    let mut albums = vec![];
    let mut buckets = BTreeMap::<(String, String), Vec<&Track>>::new();
    let mut groups = BTreeMap::<String, Vec<&Track>>::new();
    for t in tracks {
        buckets
            .entry((norm(&t.title), norm(&lead(t))))
            .or_default()
            .push(t);
        if !t.album.trim().is_empty() {
            groups.entry(base_album(t)).or_default().push(t);
        }
    }
    for ts in buckets.values() {
        for i in 0..ts.len() {
            for j in i + 1..ts.len() {
                if songs.len() < 500 && candidate_song(ts[i], ts[j]) {
                    let sig = signature("songs", &[ts[i]], &[ts[j]]);
                    if !state.dismissed.contains(&sig) {
                        songs.push(Candidate {
                            ids: [ts[i].id.clone(), ts[j].id.clone()],
                            signature: sig,
                        });
                    }
                }
            }
        }
    }
    let mut album_buckets = BTreeMap::<String, Vec<(String, Vec<&Track>)>>::new();
    for entry in groups {
        album_buckets
            .entry(norm(&album_artist(entry.1[0])))
            .or_default()
            .push(entry);
    }
    for entries in album_buckets.values() {
        for i in 0..entries.len() {
            for j in i + 1..entries.len() {
                if albums.len() >= 500 {
                    break;
                }
                let (ak, a) = &entries[i];
                let (bk, b) = &entries[j];
                if norm(&album_artist(a[0])) != norm(&album_artist(b[0]))
                    || edition(&a[0].album) != edition(&b[0].album)
                    || a[0].identity.album_identity.as_ref().is_some_and(|x| {
                        b[0].identity
                            .album_identity
                            .as_ref()
                            .is_some_and(|y| x.id == y.id)
                    })
                {
                    continue;
                }
                let aa = unique(a.iter().copied());
                let bb = unique(b.iter().copied());
                let mut used = BTreeSet::new();
                let mut matches = 0;
                for t in &aa {
                    if let Some(u) = bb.iter().find(|u| {
                        !used.contains(&u.id)
                            && (song_key(t) == song_key(u) || candidate_song(t, u))
                    }) {
                        used.insert(u.id.clone());
                        matches += 1;
                    }
                }
                if norm(&a[0].album) == norm(&b[0].album)
                    || (matches >= 2 && matches as f64 / (aa.len().min(bb.len()) as f64) >= 0.8)
                {
                    let sig = signature("albums", a, b);
                    if !state.dismissed.contains(&sig) {
                        albums.push(Candidate {
                            ids: [ak.clone(), bk.clone()],
                            signature: sig,
                        });
                    }
                }
            }
        }
    }
    (songs, albums)
}
