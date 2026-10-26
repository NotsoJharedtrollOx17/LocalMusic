use crate::*;
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};
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
fn calendar(s: &str) -> Result<NaiveDate, String> {
    let d = NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| "Invalid calendar date")?;
    if d.format("%Y-%m-%d").to_string() != s || !(1..=9999).contains(&d.year()) {
        return Err("Invalid calendar date".into());
    }
    Ok(d)
}
fn boundary(tz: Tz, s: &str) -> Result<DateTime<Utc>, String> {
    let d = calendar(s)?;
    midnight(tz, d.year(), d.month(), d.day())
}
pub fn period_for(r: &RecapRequest) -> Result<RecapPeriod, String> {
    let d = calendar(&r.anchor_date)?;
    if d.year() > 9998 {
        return Err("Invalid recap date".into());
    }
    let start = match r.kind {
        RecapKind::Week => d - Duration::days(d.weekday().num_days_from_monday() as i64),
        RecapKind::Month => d.with_day(1).unwrap(),
        RecapKind::Year => NaiveDate::from_ymd_opt(d.year(), 1, 1).unwrap(),
    };
    let end = match r.kind {
        RecapKind::Week => start + Duration::days(7),
        RecapKind::Month => start
            .checked_add_months(chrono::Months::new(1))
            .ok_or("Calendar overflow")?,
        RecapKind::Year => {
            NaiveDate::from_ymd_opt(start.year() + 1, 1, 1).ok_or("Calendar overflow")?
        }
    };
    Ok(RecapPeriod {
        kind: r.kind,
        start_date: start.to_string(),
        end_date: end.to_string(),
    })
}
fn bucket_dates(p: &RecapPeriod) -> Result<Vec<String>, String> {
    let mut d = calendar(&p.start_date)?;
    let end = calendar(&p.end_date)?;
    let mut out = vec![d.to_string()];
    while d < end {
        d = if p.kind == RecapKind::Year {
            d.checked_add_months(chrono::Months::new(1))
                .ok_or("Calendar overflow")?
        } else {
            d.succ_opt().ok_or("Calendar overflow")?
        };
        out.push(d.to_string());
    }
    Ok(out)
}
/// Normalize old frozen values in memory; never rewrite the stored snapshot.
pub fn decode_snapshot(mut v: serde_json::Value) -> Result<Recap, String> {
    if v["schemaVersion"] == 1 {
        let year = v["year"].as_i64().ok_or("Invalid snapshot year")?;
        let period = period_for(&RecapRequest {
            kind: RecapKind::Year,
            anchor_date: format!("{year:04}-01-01"),
        })?;
        let tz: Tz = v["timeZone"]
            .as_str()
            .ok_or("Invalid snapshot zone")?
            .parse()
            .map_err(|_| "Invalid snapshot zone")?;
        let from = date(v["coveredFrom"].as_str().ok_or("Invalid coverage")?)?;
        let through = date(v["coveredThrough"].as_str().ok_or("Invalid coverage")?)?;
        let months = v["months"].as_array().ok_or("Invalid snapshot buckets")?;
        if months.len() != 12 {
            return Err("Invalid snapshot buckets".into());
        }
        let edges = bucket_dates(&period)?;
        let mut buckets = Vec::new();
        for i in 0..12 {
            buckets.push(RecapBucket {
                start_date: edges[i].clone(),
                end_date: edges[i + 1].clone(),
                listened_ms: months[i].as_u64().ok_or("Invalid snapshot total")?,
                observed: from < boundary(tz, &edges[i + 1])? && through > boundary(tz, &edges[i])?,
            });
        }
        let complete = v["completeYear"].clone();
        let o = v.as_object_mut().ok_or("Invalid snapshot")?;
        for key in ["year", "months", "completeYear"] {
            o.remove(key);
        }
        o.insert("schemaVersion".into(), 2.into());
        o.insert("period".into(), serde_json::to_value(period).unwrap());
        o.insert("buckets".into(), serde_json::to_value(buckets).unwrap());
        o.insert("completePeriod".into(), complete);
    }
    if v["schemaVersion"] != 2 {
        return Err("Invalid snapshot schema".into());
    }
    serde_json::from_value(v).map_err(|e| e.to_string())
}
pub fn aggregate(
    request: &RecapRequest,
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
    let period = period_for(request)?;
    let start = boundary(tz, &period.start_date)?;
    let end = boundary(tz, &period.end_date)?;
    if start > now {
        return Err("Future recap period".into());
    }
    let history = date(&settings.history_enabled_since)?;
    let through = start.max(end.min(now));
    let from = start.max(history).min(through);
    let dates = bucket_dates(&period)?;
    let edges: Vec<_> = dates
        .iter()
        .map(|d| boundary(tz, d))
        .collect::<Result<_, _>>()?;
    let mut buckets = Vec::new();
    for i in 0..dates.len() - 1 {
        buckets.push(RecapBucket {
            start_date: dates[i].clone(),
            end_date: dates[i + 1].clone(),
            listened_ms: 0,
            observed: from < edges[i + 1]
                && through > edges[i]
                && through > from
                && edges[i + 1] > edges[i],
        });
    }
    let allowed: HashSet<_> = sessions
        .iter()
        .filter(|s| !s.excluded)
        .map(|s| s.id.as_str())
        .collect();
    let mut days = HashSet::new();
    let mut total = 0;
    for i in intervals {
        if !allowed.contains(i.session_id.as_str()) || i.played_ms == 0 {
            continue;
        }
        let a = date(&i.start_utc)?;
        let b = a + Duration::milliseconds(i.played_ms.min(i64::MAX as u64) as i64);
        for m in 0..buckets.len() {
            let l = a.max(edges[m]).max(from);
            let r = b.min(edges[m + 1]).min(through);
            if r <= l {
                continue;
            }
            let ms = (r - l).num_milliseconds() as u64;
            buckets[m].listened_ms += ms;
            total += ms;
            let mut d = l.with_timezone(&tz).date_naive();
            let last = (r - Duration::milliseconds(1))
                .with_timezone(&tz)
                .date_naive();
            while d <= last {
                if midnight(tz, d.year(), d.month(), d.day())?
                    < boundary(tz, &d.succ_opt().ok_or("Calendar overflow")?.to_string())?
                {
                    days.insert(d);
                }
                d = d.succ_opt().ok_or("Calendar overflow")?;
            }
        }
    }
    let mut counts: HashMap<&str, (u64, u64)> = HashMap::new();
    for s in sessions {
        let d = date(&s.started_at_utc)?;
        if !s.excluded && s.played_ms >= 30000 && d >= from && d < end && d <= now {
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
    let seed_input = format!(
        "{}|{}|{}|{}",
        period.kind.as_str(),
        period.start_date,
        from.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        total
    );
    let seed = format!(
        "{:08x}",
        seed_input
            .bytes()
            .fold(2166136261u32, |h, c| (h ^ (c as u32))
                .wrapping_mul(16777619))
    );
    let qualified_plays = top.iter().map(|t| t.plays).sum();
    top.truncate(25);
    Ok(Recap {
        schema_version: 2,
        privacy_revision: settings.privacy_revision,
        period,
        time_zone: settings.time_zone.clone(),
        covered_from: from.to_rfc3339(),
        covered_through: through.to_rfc3339(),
        complete_period: now >= end && history <= start,
        listened_ms: total,
        qualified_plays,
        active_days: days.len(),
        buckets,
        top_tracks: top,
        top_artist: ar.first().cloned(),
        top_album: al.first().cloned(),
        top_artists: ar.into_iter().take(3).collect(),
        top_albums: al.into_iter().take(3).collect(),
        track_ids: ids,
        visual_seed: seed,
    })
}
