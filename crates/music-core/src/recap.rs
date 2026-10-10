use crate::*;
use chrono::{DateTime, Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use std::collections::{BTreeMap, HashMap, HashSet};
pub fn midnight(tz: Tz, year: i32, month: u32, day: u32) -> Result<DateTime<Utc>, String> {
    let date = NaiveDate::from_ymd_opt(year, month, day).ok_or("Invalid calendar boundary")?;
    let naive = date.and_hms_opt(0, 0, 0).unwrap();
    for minute in 0..=2880 {
        if let Some(d) = tz
            .from_local_datetime(&(naive + Duration::minutes(minute)))
            .earliest()
        {
            return Ok(d.with_timezone(&Utc));
        }
    }
    Err("Could not resolve calendar boundary".into())
}
fn date(s: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| e.to_string())
}
pub fn aggregate(
    year: i32,
    settings: &Settings,
    tracks: &[Track],
    sessions: &[Session],
    intervals: &[Interval],
    now: DateTime<Utc>,
) -> Result<Recap, String> {
    let tz: Tz = settings
        .time_zone
        .parse()
        .map_err(|_| "Invalid time zone")?;
    let start = midnight(tz, year, 1, 1)?;
    let end = midnight(tz, year + 1, 1, 1)?;
    let history = date(&settings.history_enabled_since)?;
    let mut edges = Vec::new();
    for m in 1..=12 {
        edges.push(midnight(tz, year, m, 1)?)
    }
    edges.push(end);
    let allowed: HashSet<_> = sessions
        .iter()
        .filter(|s| !s.excluded)
        .map(|s| s.id.as_str())
        .collect();
    let mut months = [0u64; 12];
    let mut days = HashSet::new();
    let mut total = 0;
    for i in intervals {
        if !allowed.contains(i.session_id.as_str()) || i.played_ms == 0 {
            continue;
        }
        let a = date(&i.start_utc)?;
        let b = a + Duration::milliseconds(i.played_ms.min(i64::MAX as u64) as i64);
        for m in 0..12 {
            let l = a.max(edges[m]);
            let r = b.min(edges[m + 1]).min(now);
            if r <= l {
                continue;
            }
            let ms = (r - l).num_milliseconds() as u64;
            months[m] += ms;
            total += ms;
            let mut d = l.with_timezone(&tz).date_naive();
            let last = (r - Duration::milliseconds(1))
                .with_timezone(&tz)
                .date_naive();
            while d <= last {
                days.insert(d);
                d = d.succ_opt().ok_or("Calendar overflow")?;
            }
        }
    }
    let mut counts: HashMap<&str, (u64, u64)> = HashMap::new();
    for s in sessions {
        let d = date(&s.started_at_utc)?;
        if !s.excluded && s.played_ms >= 30000 && d >= start && d < end && d <= now {
            let c = counts.entry(&s.track_id).or_default();
            c.0 += 1;
            c.1 += s.played_ms;
        }
    }
    let mut top: Vec<RankedTrack> = tracks
        .iter()
        .filter_map(|t| {
            counts
                .get(t.id.as_str())
                .map(|(plays, played)| RankedTrack {
                    track: t.clone(),
                    plays: *plays,
                    played_ms: *played,
                })
        })
        .collect();
    top.sort_by(|a, b| {
        b.plays
            .cmp(&a.plays)
            .then_with(|| b.played_ms.cmp(&a.played_ms))
            .then_with(|| a.track.id.cmp(&b.track.id))
    });
    let mut artists: BTreeMap<String, ArtistRank> = BTreeMap::new();
    let mut albums: BTreeMap<String, AlbumRank> = BTreeMap::new();
    for x in &top {
        let a = artists
            .entry(normalize(&x.track.artist))
            .or_insert(ArtistRank {
                name: if x.track.artist.is_empty() {
                    "Unknown artist".into()
                } else {
                    x.track.artist.clone()
                },
                plays: 0,
            });
        a.plays += x.plays;
        if !x.track.album.is_empty() {
            let b = albums
                .entry(normalize(&format!("{}|{}", x.track.artist, x.track.album)))
                .or_insert(AlbumRank {
                    name: x.track.album.clone(),
                    artist: x.track.artist.clone(),
                    plays: 0,
                });
            b.plays += x.plays;
        }
    }
    let mut ar: Vec<_> = artists.into_values().collect();
    ar.sort_by(|a, b| {
        b.plays
            .cmp(&a.plays)
            .then_with(|| normalize(&a.name).cmp(&normalize(&b.name)))
    });
    let mut al: Vec<_> = albums.into_values().collect();
    al.sort_by(|a, b| {
        b.plays
            .cmp(&a.plays)
            .then_with(|| normalize(&a.name).cmp(&normalize(&b.name)))
            .then_with(|| normalize(&a.artist).cmp(&normalize(&b.artist)))
    });
    let available: Vec<_> = top
        .iter()
        .filter(|t| t.track.available && !t.track.hidden)
        .collect();
    let cap = if available.len() < 10 { usize::MAX } else { 2 };
    let mut artist_counts: HashMap<String, usize> = HashMap::new();
    let mut ids = Vec::new();
    for x in available {
        let c = artist_counts.entry(normalize(&x.track.artist)).or_default();
        if *c < cap && ids.len() < 25 {
            *c += 1;
            ids.push(x.track.id.clone());
        }
    }
    let from = start.max(history);
    let through = start.max(end.min(now));
    let seed = format!(
        "{:08x}",
        (total as u32).wrapping_mul(16777619) ^ (year as u32)
    );
    let qualified_plays = top.iter().map(|t| t.plays).sum();
    top.truncate(25);
    Ok(Recap {
        schema_version: 1,
        privacy_revision: settings.privacy_revision,
        year,
        time_zone: settings.time_zone.clone(),
        covered_from: from.to_rfc3339(),
        covered_through: through.to_rfc3339(),
        complete_year: now >= end && history <= start,
        listened_ms: total,
        qualified_plays,
        active_days: days.len(),
        months,
        top_tracks: top,
        top_artist: ar.into_iter().next(),
        top_album: al.into_iter().next(),
        track_ids: ids,
        visual_seed: seed,
    })
}
