use crate::{normalize, Interval, Playlist, Session, Track};
use chrono::{DateTime, Duration};
use std::collections::HashMap;

/// Derived collections never modify the user's saved playlists or history.
pub fn build(
    tracks: &[Track],
    sessions: &[Session],
    intervals: &[Interval],
    added_ids: &[String],
) -> Vec<Playlist> {
    let visible: HashMap<_, _> = tracks
        .iter()
        .filter(|t| t.available && !t.hidden)
        .map(|t| (t.id.as_str(), t))
        .collect();
    let eligible: HashMap<_, _> = sessions
        .iter()
        .filter(|s| {
            !s.excluded
                && s.played_ms > 0
                && visible.get(s.track_id.as_str()).is_some_and(|t| !t.demo)
        })
        .map(|s| (s.id.as_str(), s))
        .collect();
    let mut recent: HashMap<&str, i64> = HashMap::new();
    let mut plays: HashMap<&str, (u64, u64)> = HashMap::new();
    for s in eligible.values() {
        if let Ok(time) = DateTime::parse_from_rfc3339(&s.started_at_utc) {
            recent
                .entry(&s.track_id)
                .and_modify(|v| *v = (*v).max(time.timestamp_millis()))
                .or_insert(time.timestamp_millis());
        }
        if s.played_ms >= 30_000 {
            let count = plays.entry(&s.track_id).or_default();
            count.0 += 1;
            count.1 = count.1.saturating_add(s.played_ms);
        }
    }
    for interval in intervals.iter().filter(|i| i.played_ms > 0) {
        if let Some(session) = eligible.get(interval.session_id.as_str()) {
            if let Ok(start) = DateTime::parse_from_rfc3339(&interval.start_utc) {
                if let Some(end) = start.checked_add_signed(Duration::milliseconds(
                    interval.played_ms.min(i64::MAX as u64) as i64,
                )) {
                    recent
                        .entry(&session.track_id)
                        .and_modify(|v| *v = (*v).max(end.timestamp_millis()))
                        .or_insert(end.timestamp_millis());
                }
            }
        }
    }
    let title_order = |a: &String, b: &String| {
        normalize(&visible[a.as_str()].title)
            .cmp(&normalize(&visible[b.as_str()].title))
            .then_with(|| a.cmp(b))
    };
    let mut played: Vec<String> = recent.keys().map(|id| id.to_string()).collect();
    played.sort_by(|a, b| {
        recent[b.as_str()]
            .cmp(&recent[a.as_str()])
            .then_with(|| title_order(a, b))
    });
    played.truncate(100);
    let mut most: Vec<String> = plays.keys().map(|id| id.to_string()).collect();
    most.sort_by(|a, b| {
        plays[b.as_str()]
            .cmp(&plays[a.as_str()])
            .then_with(|| {
                recent
                    .get(b.as_str())
                    .copied()
                    .unwrap_or(0)
                    .cmp(&recent.get(a.as_str()).copied().unwrap_or(0))
            })
            .then_with(|| title_order(a, b))
    });
    most.truncate(100);
    let mut favorites: Vec<String> = visible
        .values()
        .filter(|t| t.favorite)
        .map(|t| t.id.clone())
        .collect();
    favorites.sort_by(title_order);
    let added = added_ids
        .iter()
        .filter(|id| visible.contains_key(id.as_str()))
        .take(100)
        .cloned()
        .collect();
    [
        ("recently-added", "Recently added", added),
        ("recently-played", "Recently played", played),
        ("most-played", "Most played", most),
        ("favorites", "Favorites", favorites),
    ]
    .into_iter()
    .map(|(key, title, track_ids)| Playlist {
        id: format!("automatic:{key}"),
        title: title.into(),
        kind: "automatic".into(),
        track_ids,
    })
    .collect()
}

impl crate::Store {
    pub fn automatic_playlists(&self) -> crate::store::Result<Vec<Playlist>> {
        let mut query = self
            .connection
            .prepare("SELECT id FROM tracks ORDER BY rowid DESC")
            .map_err(|e| e.to_string())?;
        let ids = query
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?;
        Ok(build(
            &self.all_tracks()?,
            &self.sessions()?,
            &self.intervals()?,
            &ids,
        ))
    }
}
