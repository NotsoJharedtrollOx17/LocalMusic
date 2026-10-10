use crate::*;
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use std::collections::{HashMap, HashSet};
pub fn generate(
    request: &PlaylistRequest,
    tracks: &[Track],
    sessions: &[Session],
    zone: &str,
    now: DateTime<Utc>,
) -> Result<Playlist, String> {
    if request.target_count.is_some() == request.target_minutes.is_some() {
        return Err("Choose count or duration".into());
    }
    if request
        .target_count
        .is_some_and(|n| !(1..=100).contains(&n))
        || request
            .target_minutes
            .is_some_and(|n| !(1..=600).contains(&n))
    {
        return Err("Playlist length is out of range".into());
    }
    let tz: Tz = zone.parse().map_err(|_| "Invalid time zone")?;
    let today = now.with_timezone(&tz).date_naive();
    let heard: HashSet<_> = sessions
        .iter()
        .filter(|s| {
            DateTime::parse_from_rfc3339(&s.started_at_utc)
                .is_ok_and(|d| d.with_timezone(&tz).date_naive() == today)
        })
        .map(|s| s.track_id.as_str())
        .collect();
    let excluded = normalize(&request.exclude_artist);
    let included = normalize(&request.include_artist);
    let genre = normalize(&request.genre);
    let mut pool: Vec<_> = tracks
        .iter()
        .filter(|t| {
            t.available
                && !t.hidden
                && (excluded.is_empty() || normalize(&t.artist) != excluded)
                && (included.is_empty() || normalize(&t.artist) == included)
                && (genre.is_empty()
                    || t.genre
                        .split([',', ';', '/'])
                        .any(|g| normalize(g) == genre))
                && (!request.avoid_heard_today || !heard.contains(t.id.as_str()))
        })
        .collect();
    pool.sort_by(|a, b| {
        let pref = if request.prefer_favorites {
            b.favorite.cmp(&a.favorite)
        } else {
            std::cmp::Ordering::Equal
        };
        pref.then_with(|| a.id.cmp(&b.id))
    });
    let mut ids = Vec::new();
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut seen = HashSet::new();
    let mut elapsed = 0u64;
    let budget = request
        .target_minutes
        .map(|m| m * 60000)
        .unwrap_or(u64::MAX);
    for t in pool {
        if ids.len() >= request.target_count.unwrap_or(100) {
            break;
        }
        let artist = normalize(&t.artist);
        let count = counts.entry(artist).or_default();
        if *count >= 2
            || seen.contains(&t.id)
            || elapsed.saturating_add(t.duration_ms) > budget
            || (budget != u64::MAX && t.duration_ms == 0)
        {
            continue;
        }
        *count += 1;
        elapsed += t.duration_ms;
        seen.insert(&t.id);
        ids.push(t.id.clone());
    }
    Ok(Playlist {
        id: uuid::Uuid::new_v4().to_string(),
        title: if request.title.trim().is_empty() {
            "A mix for you".into()
        } else {
            request.title.trim().into()
        },
        kind: "generated".into(),
        track_ids: ids,
    })
}
