//! Offline ranking. No listening records are created or changed here.
use crate::{normalize, Playlist, PlaylistRequest, Session, Track};
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AcousticFeature {
    pub version: u32,
    pub fingerprint: String,
    pub bands: Vec<f64>,
    pub seconds: f64,
}
impl AcousticFeature {
    pub fn valid(&self) -> bool {
        self.version == 1
            && self.seconds.is_finite()
            && self.seconds >= 0.1
            && self.bands.len() == 32
            && self.bands.iter().all(|x| x.is_finite() && *x >= 0.0)
            && (self.bands.iter().sum::<f64>() - 1.0).abs() < 0.001
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RecommendationData {
    pub less: Vec<String>,
    pub features: BTreeMap<String, AcousticFeature>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixRecommendation {
    pub source: String,
    pub analyzed: usize,
    pub total: usize,
    pub shortage: bool,
    pub reasons: BTreeMap<String, Vec<String>>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedMix {
    #[serde(flatten)]
    pub playlist: Playlist,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommendation: Option<MixRecommendation>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlaylistContext {
    pub artists: Vec<String>,
    pub genres: Vec<String>,
    pub less: Vec<String>,
    pub analyzed: usize,
    pub total: usize,
    pub scanning: bool,
}
fn tags(s: &str) -> Vec<String> {
    let mut v: Vec<_> = s
        .split([',', ';', '/'])
        .map(normalize)
        .filter(|s| !s.is_empty())
        .collect();
    v.sort();
    v.dedup();
    v
}
pub fn analysis_order(tracks: &[Track], sessions: &[Session]) -> Vec<Track> {
    let mut counts = BTreeMap::<String, u64>::new();
    for s in sessions
        .iter()
        .filter(|s| !s.excluded && s.played_ms >= 30000)
    {
        *counts.entry(s.track_id.clone()).or_default() += 1;
    }
    let pool: Vec<_> = tracks
        .iter()
        .filter(|t| t.available && !t.hidden && !t.demo)
        .collect();
    let mut anchors: Vec<_> = pool
        .iter()
        .copied()
        .filter(|t| t.favorite || counts.contains_key(&t.id))
        .collect();
    anchors.sort_by(|a, b| {
        counts
            .get(&b.id)
            .unwrap_or(&0)
            .cmp(counts.get(&a.id).unwrap_or(&0))
            .then(b.favorite.cmp(&a.favorite))
            .then(a.id.cmp(&b.id))
    });
    let anchored: HashSet<_> = anchors.iter().map(|t| t.id.as_str()).collect();
    let mut groups = BTreeMap::<String, Vec<&Track>>::new();
    for t in pool {
        if !anchored.contains(t.id.as_str()) {
            let artist = normalize(&t.artist);
            groups
                .entry(if artist.is_empty() {
                    t.id.clone()
                } else {
                    artist
                })
                .or_default()
                .push(t);
        }
    }
    for g in groups.values_mut() {
        g.sort_by(|a, b| a.id.cmp(&b.id));
    }
    let mut out: Vec<_> = anchors.into_iter().cloned().collect();
    let mut i = 0;
    loop {
        let mut added = false;
        for g in groups.values() {
            if let Some(t) = g.get(i) {
                out.push((*t).clone());
                added = true;
            }
        }
        if !added {
            break;
        }
        i += 1;
    }
    out
}
pub fn generate(
    request: &PlaylistRequest,
    tracks: &[Track],
    sessions: &[Session],
    zone: &str,
    now: DateTime<Utc>,
    data: &RecommendationData,
) -> Result<GeneratedMix, String> {
    // Share validation and keep legacy requests on the original policy.
    let mut playlist = crate::playlist::generate(request, tracks, sessions, zone, now)?;
    let Some(blend) = request.blend.as_deref() else {
        return Ok(GeneratedMix {
            playlist,
            recommendation: None,
        });
    };
    let weights = match blend {
        "familiar" => [0.4, 0.3, 0.2, 0.1],
        "balanced" => [0.25, 0.3, 0.25, 0.2],
        "explore" => [0.1, 0.25, 0.25, 0.4],
        _ => return Err("Invalid playlist blend".into()),
    };
    let tz: Tz = zone.parse().map_err(|_| "Invalid time zone")?;
    let now_ms = now.timestamp_millis() as f64;
    let day = 86400000.0;
    let eligible: Vec<_> = sessions
        .iter()
        .filter_map(|s| {
            let date = DateTime::parse_from_rfc3339(&s.started_at_utc).ok()?;
            if s.excluded || s.played_ms < 30000 || date > now {
                return None;
            }
            Some((s, date))
        })
        .collect();
    let recent: Vec<_> = eligible
        .iter()
        .filter(|(_, d)| now_ms - d.timestamp_millis() as f64 <= 90.0 * day)
        .collect();
    let taste: Vec<_> = if recent.is_empty() {
        eligible.iter().collect()
    } else {
        recent
    };
    let mut affinity = BTreeMap::<String, f64>::new();
    let mut plays = BTreeMap::<String, u64>::new();
    let mut last = BTreeMap::<String, f64>::new();
    for (s, d) in &eligible {
        *plays.entry(s.track_id.clone()).or_default() += 1;
        let v = last.entry(s.track_id.clone()).or_default();
        *v = v.max(d.timestamp_millis() as f64);
    }
    for (s, d) in taste {
        *affinity.entry(s.track_id.clone()).or_default() +=
            2f64.powf(-(now_ms - d.timestamp_millis() as f64) / (30.0 * day));
    }
    let positive: Vec<_> = tracks
        .iter()
        .filter(|t| t.available && !t.hidden && !t.demo)
        .collect();
    let history = positive
        .iter()
        .any(|t| affinity.get(&t.id).is_some_and(|v| *v > 0.0));
    if !history {
        affinity.clear();
        for t in &positive {
            if t.favorite {
                affinity.insert(t.id.clone(), 1.0);
            }
        }
    }
    let source = if history {
        "history"
    } else if !affinity.is_empty() {
        "favorites"
    } else {
        "discovery"
    }
    .to_string();
    let mut anchors: Vec<_> = positive
        .into_iter()
        .filter(|t| affinity.contains_key(&t.id))
        .collect();
    anchors.sort_by(|a, b| {
        affinity[&b.id]
            .total_cmp(&affinity[&a.id])
            .then(a.id.cmp(&b.id))
    });
    let mut artists = BTreeMap::<String, f64>::new();
    let mut genres = BTreeMap::<String, f64>::new();
    let mut years = Vec::<(u32, f64)>::new();
    for t in &anchors {
        let w = affinity[&t.id];
        let a = normalize(&t.artist);
        if !a.is_empty() {
            *artists.entry(a).or_default() += w;
        }
        for g in tags(&t.genre) {
            *genres.entry(g).or_default() += w;
        }
        if let Some(y) = t.release_year {
            years.push((y, w));
        }
    }
    let max_a = artists.values().copied().fold(0.0, f64::max);
    let max_g = genres.values().copied().fold(0.0, f64::max);
    let max_l = affinity.values().copied().fold(0.0, f64::max);
    let valid = |id: &str| data.features.get(id).is_some_and(AcousticFeature::valid);
    let mut acoustic = Vec::new();
    let mut seen = HashSet::new();
    for t in &anchors {
        let a = normalize(&t.artist);
        if valid(&t.id) && seen.insert(if a.is_empty() { t.id.clone() } else { a }) {
            acoustic.push(*t);
            if acoustic.len() == 32 {
                break;
            }
        }
    }
    for t in &anchors {
        if acoustic.len() < 32 && valid(&t.id) && !acoustic.iter().any(|a| a.id == t.id) {
            acoustic.push(*t);
        }
    }
    let today = now.with_timezone(&tz).date_naive();
    let heard: HashSet<_> = eligible
        .iter()
        .filter(|(_, d)| d.with_timezone(&tz).date_naive() == today)
        .map(|(s, _)| s.track_id.as_str())
        .collect();
    let exclude = normalize(&request.exclude_artist);
    let include = normalize(&request.include_artist);
    let genre = normalize(&request.genre);
    let mut pool: Vec<_> = tracks
        .iter()
        .filter(|t| {
            t.available
                && !t.hidden
                && (exclude.is_empty() || normalize(&t.artist) != exclude)
                && (include.is_empty() || normalize(&t.artist) == include)
                && (genre.is_empty() || tags(&t.genre).contains(&genre))
                && (!request.avoid_heard_today || !heard.contains(t.id.as_str()))
        })
        .collect();
    pool.sort_by(|a, b| a.id.cmp(&b.id));
    pool.dedup_by(|a, b| a.id == b.id);
    let analyzed = pool.iter().filter(|t| valid(&t.id)).count();
    let total = pool.len();
    let mut seed = request.seed.unwrap_or(1);
    let mut reasons = BTreeMap::new();
    let mut scored = Vec::new();
    for t in pool {
        let mut parts = Vec::new();
        let mut why = Vec::<String>::new();
        if max_l > 0.0 {
            parts.push((
                affinity.get(&t.id).unwrap_or(&0.0).ln_1p() / max_l.ln_1p(),
                weights[0],
            ));
            if affinity.contains_key(&t.id) {
                why.push(
                    if source == "favorites" {
                        "favorite"
                    } else {
                        "listening"
                    }
                    .into(),
                );
            }
        }
        let mut meta = Vec::new();
        let gs = tags(&t.genre);
        if max_g > 0.0 && !gs.is_empty() {
            meta.push((
                gs.iter()
                    .map(|g| genres.get(g).unwrap_or(&0.0) / max_g)
                    .fold(0.0, f64::max),
                0.6,
            ));
        }
        let a = normalize(&t.artist);
        if max_a > 0.0 && !a.is_empty() {
            meta.push((artists.get(&a).unwrap_or(&0.0) / max_a, 0.3));
        }
        if let Some(y) = t.release_year {
            if !years.is_empty() {
                meta.push((
                    years
                        .iter()
                        .map(|(v, w)| w * (-((*v as f64) - (y as f64)).abs() / 10.0).exp())
                        .sum::<f64>()
                        / years.iter().map(|(_, w)| w).sum::<f64>(),
                    0.1,
                ));
            }
        }
        if !meta.is_empty() {
            let m = meta.iter().map(|(v, w)| v * w).sum::<f64>()
                / meta.iter().map(|(_, w)| w).sum::<f64>();
            parts.push((m, weights[1]));
            if m > 0.25 {
                why.push("metadata".into());
            }
        }
        if valid(&t.id) && !acoustic.is_empty() {
            let f = &data.features[&t.id];
            let mut matches: Vec<_> = acoustic
                .iter()
                .filter(|a| a.id != t.id)
                .map(|a| {
                    data.features[&a.id]
                        .bands
                        .iter()
                        .zip(&f.bands)
                        .map(|(a, b)| (a * b).sqrt())
                        .sum::<f64>()
                })
                .collect();
            matches.sort_by(|a, b| b.total_cmp(a));
            matches.truncate(3);
            if !matches.is_empty() {
                parts.push((
                    matches.iter().sum::<f64>() / matches.len() as f64,
                    weights[2],
                ));
                why.push("sound".into());
            }
        }
        let count = *plays.get(&t.id).unwrap_or(&0) as f64;
        let fresh = 0.5 / (1.0 + count)
            + 0.5
                * last
                    .get(&t.id)
                    .map_or(1.0, |v| ((now_ms - v) / (30.0 * day)).min(1.0));
        parts.push((fresh, weights[3]));
        if fresh > 0.5 {
            why.push("fresh".into());
        }
        let score = (0.05
            + parts.iter().map(|(v, w)| v * w).sum::<f64>()
                / parts.iter().map(|(_, w)| w).sum::<f64>())
            * if request.prefer_favorites && t.favorite {
                1.25
            } else {
                1.0
            }
            * if data.less.contains(&t.id) { 0.1 } else { 1.0 };
        if data.less.contains(&t.id) {
            why.push("less".into());
        }
        reasons.insert(t.id.clone(), why);
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        let u = (seed as f64 + 0.5) / 4294967296.0;
        scored.push((t, -u.ln() / score));
    }
    scored.sort_by(|(a, sa), (b, sb)| sa.total_cmp(sb).then(a.id.cmp(&b.id)));
    let mut selected = Vec::new();
    let mut counts = BTreeMap::<String, usize>::new();
    let mut elapsed = 0u64;
    for (t, _) in scored {
        if selected.len() >= request.target_count.unwrap_or(100) {
            break;
        }
        let a = normalize(&t.artist);
        if include.is_empty() && !a.is_empty() && *counts.get(&a).unwrap_or(&0) >= 2 {
            continue;
        }
        if request
            .target_minutes
            .is_some_and(|m| t.duration_ms == 0 || elapsed + t.duration_ms > m * 60000)
        {
            continue;
        }
        selected.push(t);
        elapsed += t.duration_ms;
        if !a.is_empty() {
            *counts.entry(a).or_default() += 1;
        }
    }
    let mut ordered: Vec<&Track> = Vec::new();
    while !selected.is_empty() {
        let last = ordered
            .last()
            .map_or(String::new(), |t| normalize(&t.artist));
        let i = selected
            .iter()
            .position(|t| normalize(&t.artist).is_empty() || normalize(&t.artist) != last)
            .unwrap_or(0);
        ordered.push(selected.remove(i));
    }
    playlist.track_ids = ordered.iter().map(|t| t.id.clone()).collect();
    reasons.retain(|id, _| playlist.track_ids.contains(id));
    let shortage = request.target_count.map_or_else(
        || elapsed < request.target_minutes.unwrap_or(0) * 60000,
        |n| playlist.track_ids.len() < n,
    );
    Ok(GeneratedMix {
        playlist,
        recommendation: Some(MixRecommendation {
            source,
            analyzed,
            total,
            shortage,
            reasons,
        }),
    })
}
