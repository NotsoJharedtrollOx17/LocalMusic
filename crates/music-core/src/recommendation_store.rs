use crate::recommendation::{AcousticFeature, PlaylistContext, RecommendationData};
use crate::{Store, Track};
use rusqlite::params;
impl Store {
    pub fn suggestion_feedback(&self, id: &str, less: bool) -> Result<(), String> {
        if self.track(id)?.is_none() {
            return Err("Unknown track".into());
        }
        if less {
            self.connection
                .execute("INSERT OR IGNORE INTO suggestion_less VALUES(?1)", [id])
        } else {
            self.connection
                .execute("DELETE FROM suggestion_less WHERE track_id=?1", [id])
        }
        .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn recommendation_data(&self) -> Result<RecommendationData, String> {
        let mut out = RecommendationData::default();
        let mut st = self
            .connection
            .prepare("SELECT track_id FROM suggestion_less ORDER BY track_id")
            .map_err(|e| e.to_string())?;
        out.less = st
            .query_map([], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?;
        let mut st = self
            .connection
            .prepare("SELECT track_id,data FROM acoustic_features")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, raw) = row.map_err(|e| e.to_string())?;
            if let Ok(f) = serde_json::from_str::<AcousticFeature>(&raw) {
                if f.valid() {
                    if let Some(t) = self.track(&id)? {
                        if f.fingerprint == self.acoustic_fingerprint(&t)? {
                            out.features.insert(id, f);
                        }
                    }
                }
            }
        }
        Ok(out)
    }
    pub fn acoustic_fingerprint(&self, t: &Track) -> Result<String, String> {
        let source_revision = self.get_setting::<String>(&format!("acoustic-source:{}", t.id))?;
        let alias: Option<(Option<u64>, Option<String>)> = self
            .connection
            .query_row(
                "SELECT file_size,modified_utc FROM track_sources WHERE uri=?1",
                [&t.source_uri],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        #[cfg(not(target_os = "android"))]
        let file = std::fs::metadata(&t.source_uri).ok().map(|m| {
            (
                m.len(),
                m.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_nanos().to_string()),
            )
        });
        #[cfg(target_os = "android")]
        let file: Option<(u64, Option<String>)> = None;
        serde_json::to_string(&(
            1,
            &t.source_uri,
            t.duration_ms,
            alias,
            file,
            source_revision,
        ))
        .map_err(|e| e.to_string())
    }
    pub fn save_acoustic(&self, id: &str, feature: &AcousticFeature) -> Result<(), String> {
        if !feature.valid() {
            return Err("Invalid acoustic descriptor".into());
        }
        let t = self.track(id)?.ok_or("Unknown track")?;
        if self.acoustic_fingerprint(&t)? != feature.fingerprint {
            return Err("Audio source changed during analysis".into());
        }
        self.connection.execute("INSERT INTO acoustic_features VALUES(?1,?2) ON CONFLICT(track_id) DO UPDATE SET data=excluded.data",params![id,serde_json::to_string(feature).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn playlist_context(&self, scanning: bool) -> Result<PlaylistContext, String> {
        let tracks: Vec<_> = self
            .all_tracks()?
            .into_iter()
            .filter(|t| t.available && !t.hidden && !t.demo)
            .collect();
        let data = self.recommendation_data()?;
        let mut artists: Vec<_> = tracks
            .iter()
            .map(|t| t.artist.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        artists.sort();
        artists.dedup();
        let mut genres: Vec<_> = tracks
            .iter()
            .flat_map(|t| t.genre.split([',', ';', '/']))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        genres.sort();
        genres.dedup();
        Ok(PlaylistContext {
            artists,
            genres,
            less: data.less,
            analyzed: tracks
                .iter()
                .filter(|t| data.features.contains_key(&t.id))
                .count(),
            total: tracks.len(),
            scanning,
        })
    }
}
