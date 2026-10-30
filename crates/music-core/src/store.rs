use crate::*;
use rusqlite::{params, Connection};
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;
pub struct Store {
    pub connection: Connection,
    pub(crate) group_search_cache: std::cell::RefCell<
        std::collections::HashMap<String, (u64, Vec<(String, String, String, String)>)>,
    >,
    pub(crate) membership_cache:
        std::cell::RefCell<std::collections::BTreeMap<String, (u64, Vec<String>)>>,
    pub(crate) catalog_revision: std::cell::Cell<u64>,
    pub(crate) search_cache: std::cell::RefCell<Option<(u64, Vec<(String, String, String)>)>>,
}
const SCHEMA: &str = r#"
PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS tracks(id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL,album TEXT NOT NULL,data TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(id UNINDEXED,title,artist,album,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS track_sources(uri TEXT PRIMARY KEY,track_id TEXT NOT NULL REFERENCES tracks(id),file_size INTEGER,modified_utc TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playlists(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,track_id TEXT NOT NULL REFERENCES tracks(id),started_utc TEXT NOT NULL,played_ms INTEGER NOT NULL CHECK(played_ms>=0),excluded INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intervals(session_id TEXT NOT NULL REFERENCES sessions(id),sequence INTEGER NOT NULL,start_utc TEXT NOT NULL,played_ms INTEGER NOT NULL CHECK(played_ms>=0),PRIMARY KEY(session_id,sequence));
CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(started_utc);
CREATE INDEX IF NOT EXISTS idx_intervals_start ON intervals(start_utc);
CREATE INDEX IF NOT EXISTS idx_sources_track ON track_sources(track_id);
CREATE TABLE IF NOT EXISTS hidden_tracks(track_id TEXT PRIMARY KEY REFERENCES tracks(id));
CREATE TABLE IF NOT EXISTS suggestion_less(track_id TEXT PRIMARY KEY REFERENCES tracks(id));
CREATE TABLE IF NOT EXISTS acoustic_features(track_id TEXT PRIMARY KEY REFERENCES tracks(id),data TEXT NOT NULL);
PRAGMA user_version=3;
"#;
pub type Result<T> = std::result::Result<T, String>;
impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let connection = Connection::open(path).map_err(|e| e.to_string())?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        connection
            .execute_batch(SCHEMA)
            .map_err(|e| e.to_string())?;
        let s = Self {
            connection,
            search_cache: Default::default(),
            catalog_revision: Default::default(),
            group_search_cache: Default::default(),
            membership_cache: Default::default(),
        };
        if s.get_setting::<Settings>("preferences")?.is_none() {
            s.set_setting("preferences", &Settings::default())?;
        }
        Ok(s)
    }
    pub fn get_setting<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let mut st = self
            .connection
            .prepare("SELECT value FROM settings WHERE key=?1")
            .map_err(|e| e.to_string())?;
        let mut rows = st.query([key]).map_err(|e| e.to_string())?;
        match rows.next().map_err(|e| e.to_string())? {
            Some(row) => {
                let raw: String = row.get(0).map_err(|e| e.to_string())?;
                Ok(Some(serde_json::from_str(&raw).map_err(|e| e.to_string())?))
            }
            None => Ok(None),
        }
    }
    pub fn set_setting<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let raw = serde_json::to_string(value).map_err(|e| e.to_string())?;
        self.connection.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,raw]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn tracks(&self, query: &str, offset: usize, limit: usize) -> Result<LibraryPage> {
        self.tracks_with_options(query, offset, limit, false, "title")
    }
    pub fn source_uris(&self, id: &str) -> Result<Vec<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT uri FROM track_sources WHERE track_id=?1 ORDER BY uri")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    pub fn all_tracks(&self) -> Result<Vec<Track>> {
        let mut tracks: Vec<Track> = self.json_rows("SELECT data FROM tracks")?;
        let hidden = self.hidden_ids()?;
        for track in &mut tracks {
            track.hidden = hidden.contains(&track.id);
        }
        Ok(tracks)
    }
    pub fn hidden_ids(&self) -> Result<std::collections::HashSet<String>> {
        let mut st = self
            .connection
            .prepare("SELECT track_id FROM hidden_tracks")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<_>>()
            .map_err(|e| e.to_string())
    }
    pub fn set_library_visibility(&mut self, ids: &[String], visible: bool) -> Result<()> {
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        for id in ids {
            if visible {
                tx.execute("DELETE FROM hidden_tracks WHERE track_id=?1", [id])
                    .map_err(|e| e.to_string())?;
            } else {
                tx.execute(
                    "INSERT OR IGNORE INTO hidden_tracks SELECT id FROM tracks WHERE id=?1",
                    [id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        self.catalog_revision
            .set(self.catalog_revision.get().wrapping_add(1));
        Ok(())
    }
    pub fn track(&self, id: &str) -> Result<Option<Track>> {
        let mut st = self
            .connection
            .prepare("SELECT data FROM tracks WHERE id=?1")
            .map_err(|e| e.to_string())?;
        let mut rows = st.query([id]).map_err(|e| e.to_string())?;
        if let Some(r) = rows.next().map_err(|e| e.to_string())? {
            let s: String = r.get(0).map_err(|e| e.to_string())?;
            let mut track: Track = serde_json::from_str(&s).map_err(|e| e.to_string())?;
            track.hidden = self
                .connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM hidden_tracks WHERE track_id=?1)",
                    [id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            Ok(Some(track))
        } else {
            Ok(None)
        }
    }
    pub fn upsert_track(&mut self, t: &Track) -> Result<()> {
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let mut stored = t.clone();
        stored.hidden = false; // visibility is authoritative in hidden_tracks
        let json = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO tracks VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET title=excluded.title,artist=excluded.artist,album=excluded.album,data=excluded.data",params![t.id,t.title,t.artist,t.album,json]).map_err(|e|e.to_string())?;
        tx.execute("DELETE FROM tracks_fts WHERE id=?1", [&t.id])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO tracks_fts VALUES(?1,?2,?3,?4)",
            params![t.id, t.title, t.artist, t.album],
        )
        .map_err(|e| e.to_string())?;
        if t.available {
            tx.execute("INSERT INTO track_sources(uri,track_id) VALUES(?1,?2) ON CONFLICT(uri) DO UPDATE SET track_id=excluded.track_id",params![t.source_uri,t.id]).map_err(|e|e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        self.catalog_revision
            .set(self.catalog_revision.get().wrapping_add(1));
        Ok(())
    }
    pub fn save_playlist(&self, p: &Playlist) -> Result<()> {
        if p.id.starts_with("automatic:")
            || !["manual", "generated", "recap"].contains(&p.kind.as_str())
            || p.title.trim().is_empty()
            || p.title.len() > 240
        {
            return Err("Invalid playlist".into());
        }
        for id in &p.track_ids {
            if self.track(id)?.is_none() {
                return Err("Playlist contains an unknown track".into());
            }
        }
        self.connection.execute("INSERT INTO playlists VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",params![p.id,serde_json::to_string(p).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn delete_playlist(&self, id: &str) -> Result<()> {
        if id.starts_with("automatic:") {
            return Err("Automatic collections cannot be deleted".into());
        }
        self.connection
            .execute("DELETE FROM playlists WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn playlists(&self) -> Result<Vec<Playlist>> {
        self.json_rows("SELECT data FROM playlists ORDER BY id")
    }
    pub fn sessions(&self) -> Result<Vec<Session>> {
        self.json_rows("SELECT data FROM sessions")
    }
    pub fn intervals(&self) -> Result<Vec<Interval>> {
        let mut st=self.connection.prepare("SELECT session_id,sequence,start_utc,played_ms FROM intervals ORDER BY start_utc,sequence").map_err(|e|e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(Interval {
                    session_id: r.get(0)?,
                    sequence: r.get(1)?,
                    start_utc: r.get(2)?,
                    played_ms: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    // Sessions carry absolute totals. Intervals use a composite primary key. Replaying an outbox batch cannot add duration twice.
    pub fn ingest(&mut self, s: &Session, interval: Option<&Interval>) -> Result<()> {
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let mut old: Option<Session> = None;
        {
            let mut st = tx
                .prepare("SELECT data FROM sessions WHERE id=?1")
                .map_err(|e| e.to_string())?;
            let mut rows = st.query([&s.id]).map_err(|e| e.to_string())?;
            if let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let raw: String = row.get(0).map_err(|e| e.to_string())?;
                old = Some(serde_json::from_str(&raw).map_err(|e| e.to_string())?);
            }
        }
        let privacy_changed = old
            .as_ref()
            .is_some_and(|x| x.excluded != s.excluded && x.played_ms <= s.played_ms);
        let effective = if old.as_ref().is_some_and(|x| x.played_ms > s.played_ms) {
            old.unwrap()
        } else {
            s.clone()
        };
        tx.execute("INSERT INTO sessions VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET played_ms=MAX(sessions.played_ms,excluded.played_ms),excluded=excluded.excluded,data=excluded.data",params![effective.id,effective.track_id,effective.started_at_utc,effective.played_ms,effective.excluded,serde_json::to_string(&effective).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
        if let Some(i) = interval {
            if i.session_id != s.id {
                return Err("Mismatched journal session".into());
            }
            chrono::DateTime::parse_from_rfc3339(&i.start_utc).map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT OR IGNORE INTO intervals VALUES(?1,?2,?3,?4)",
                params![i.session_id, i.sequence, i.start_utc, i.played_ms],
            )
            .map_err(|e| e.to_string())?;
        }
        if privacy_changed {
            let raw: String = tx
                .query_row(
                    "SELECT value FROM settings WHERE key='preferences'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            let mut prefs: Settings = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
            prefs.privacy_revision += 1;
            tx.execute(
                "UPDATE settings SET value=?1 WHERE key='preferences'",
                [serde_json::to_string(&prefs).map_err(|e| e.to_string())?],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn bump_privacy_revision(&self) -> Result<()> {
        let mut prefs = self
            .get_setting::<Settings>("preferences")?
            .unwrap_or_default();
        prefs.privacy_revision += 1;
        self.set_setting("preferences", &prefs)
    }
    pub fn exclude_session(&self, id: &str, excluded: bool) -> Result<()> {
        let sessions = self.sessions()?;
        if let Some(mut s) = sessions.into_iter().find(|s| s.id == id) {
            if s.excluded != excluded {
                self.bump_privacy_revision()?;
            }
            s.excluded = excluded;
            self.connection
                .execute(
                    "UPDATE sessions SET excluded=?2,data=?3 WHERE id=?1",
                    params![
                        id,
                        excluded,
                        serde_json::to_string(&s).map_err(|e| e.to_string())?
                    ],
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    pub fn save_snapshot(&self, r: &Recap) -> Result<()> {
        self.connection
            .execute(
                "INSERT INTO snapshots VALUES(?1,?2)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    serde_json::to_string(r).map_err(|e| e.to_string())?
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn snapshots(&self) -> Result<Vec<Recap>> {
        self.json_rows::<serde_json::Value>("SELECT data FROM snapshots ORDER BY id")?
            .into_iter()
            .map(crate::recap::decode_snapshot)
            .collect()
    }
    pub fn delete_history(&mut self) -> Result<()> {
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch("DELETE FROM intervals; DELETE FROM sessions; DELETE FROM snapshots;")
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        let mut s = self
            .get_setting::<Settings>("preferences")?
            .unwrap_or_default();
        s.history_enabled_since = chrono::Utc::now().to_rfc3339();
        s.privacy_revision += 1;
        self.set_setting("preferences", &s)
    }
    fn json_rows<T: DeserializeOwned>(&self, sql: &str) -> Result<Vec<T>> {
        let mut st = self.connection.prepare(sql).map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(
                serde_json::from_str(&r.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?,
            );
        }
        Ok(out)
    }
}
