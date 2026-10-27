use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(default)]
    pub release_year: Option<u32>,
    #[serde(default)]
    pub release_metadata_read: bool,
    pub genre: String,
    #[serde(default)]
    pub track_number: Option<u32>,
    #[serde(default)]
    pub disc_number: Option<u32>,
    #[serde(default)]
    pub order_metadata_read: bool,
    pub duration_ms: u64,
    pub source_uri: String,
    #[serde(default)]
    pub artwork_url: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default = "yes")]
    pub available: bool,
    #[serde(default)]
    pub demo: bool,
    #[serde(default)]
    pub hidden: bool,
}
fn yes() -> bool {
    true
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub track_id: String,
    pub started_at_utc: String,
    pub played_ms: u64,
    pub excluded: bool,
    #[serde(default)]
    pub end_reason: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Interval {
    pub session_id: String,
    pub sequence: u64,
    pub start_utc: String,
    pub played_ms: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub playlist_blend: Option<String>,
    #[serde(default)]
    pub visualizer_mode: Option<String>,
    #[serde(default)]
    pub recap_period: RecapKind,
    pub language: String,
    pub theme: String,
    pub time_zone: String,
    pub history_enabled_since: String,
    #[serde(default)]
    pub privacy_revision: u64,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            playlist_blend: None,
            visualizer_mode: None,
            recap_period: RecapKind::Year,
            language: "en".into(),
            theme: "system".into(),
            time_zone: "UTC".into(),
            history_enabled_since: chrono::Utc::now().to_rfc3339(),
            privacy_revision: 0,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub track_ids: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistRequest {
    #[serde(default)]
    pub blend: Option<String>,
    #[serde(default)]
    pub seed: Option<u32>,
    pub title: String,
    pub target_count: Option<usize>,
    pub target_minutes: Option<u64>,
    pub genre: String,
    pub include_artist: String,
    pub exclude_artist: String,
    #[serde(default)]
    pub include_artists: Vec<String>,
    #[serde(default)]
    pub exclude_artists: Vec<String>,
    pub prefer_favorites: bool,
    pub avoid_heard_today: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub track_id: Option<String>,
    pub playing: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub queue: Vec<String>,
    pub queue_index: usize,
    pub shuffle: bool,
    pub repeat: String,
    pub excluded: bool,
    pub error: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankedTrack {
    pub track: Track,
    pub plays: u64,
    pub played_ms: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ArtistRank {
    pub name: String,
    pub plays: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumRank {
    pub name: String,
    pub artist: String,
    pub plays: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub track_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recap {
    pub schema_version: u32,
    #[serde(default)]
    pub privacy_revision: u64,
    pub period: RecapPeriod,
    pub time_zone: String,
    pub covered_from: String,
    pub covered_through: String,
    pub complete_period: bool,
    pub listened_ms: u64,
    pub qualified_plays: u64,
    pub active_days: usize,
    pub buckets: Vec<RecapBucket>,
    pub top_tracks: Vec<RankedTrack>,
    #[serde(default)]
    pub top_artists: Vec<ArtistRank>,
    #[serde(default)]
    pub top_albums: Vec<AlbumRank>,
    pub top_artist: Option<ArtistRank>,
    pub top_album: Option<AlbumRank>,
    pub track_ids: Vec<String>,
    pub visual_seed: String,
}
#[derive(Serialize)]
pub struct LibraryPage {
    pub tracks: Vec<Track>,
    pub total: usize,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecapKind {
    Week,
    Month,
    #[default]
    Year,
}
impl RecapKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Week => "week",
            Self::Month => "month",
            Self::Year => "year",
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecapRequest {
    pub kind: RecapKind,
    pub anchor_date: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecapPeriod {
    pub kind: RecapKind,
    pub start_date: String,
    pub end_date: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecapBucket {
    pub start_date: String,
    pub end_date: String,
    pub listened_ms: u64,
    pub observed: bool,
}
