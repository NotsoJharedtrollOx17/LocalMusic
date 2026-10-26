use chrono::{DateTime, Utc};
use music_core::*;
use serde_json::{json, Value};

#[test]
fn shared_top_three_rankings() {
    let f: Value =
        serde_json::from_str(include_str!("../../../tests/fixtures/recap-rankings.json")).unwrap();
    let mut tracks = Vec::new();
    let mut sessions = Vec::new();
    for x in f["tracks"].as_array().unwrap() {
        let mut t = x.clone();
        t["durationMs"] = json!(60000);
        t["sourceUri"] = json!("/private/audio");
        t["favorite"] = json!(false);
        t["genre"] = json!("");
        tracks.push(serde_json::from_value::<Track>(t).unwrap());
        for i in 0..x["plays"].as_u64().unwrap() {
            sessions.push(Session {
                id: format!("{}-{i}", x["id"].as_str().unwrap()),
                track_id: x["id"].as_str().unwrap().into(),
                started_at_utc: "2026-10-20T12:00:00Z".into(),
                played_ms: 30000,
                excluded: x["excluded"].as_bool().unwrap(),
                end_reason: None,
            });
        }
    }
    let r = recap::aggregate(
        &RecapRequest {
            kind: RecapKind::Week,
            anchor_date: "2026-10-25".into(),
        },
        &Settings {
            time_zone: "UTC".into(),
            history_enabled_since: "2026-01-01T00:00:00Z".into(),
            ..Default::default()
        },
        &tracks,
        &sessions,
        &[],
        "2026-10-25T12:00:00Z".parse::<DateTime<Utc>>().unwrap(),
    )
    .unwrap();
    assert_eq!(
        json!(r.top_tracks.iter().map(|x| &x.track.id).collect::<Vec<_>>()),
        f["expected"]["songs"]
    );
    assert_eq!(
        json!(r.top_artists.iter().map(|x| &x.name).collect::<Vec<_>>()),
        f["expected"]["artists"]
    );
    assert_eq!(
        json!(r
            .top_albums
            .iter()
            .map(|x| [&x.name, &x.artist])
            .collect::<Vec<_>>()),
        f["expected"]["albums"]
    );
    assert_eq!(r.top_artist.as_ref().unwrap().name, r.top_artists[0].name);
    assert_eq!(r.top_album.as_ref().unwrap().name, r.top_albums[0].name);
    assert_eq!(
        r.top_albums
            .iter()
            .map(|x| x.track_id.as_deref().unwrap())
            .collect::<Vec<_>>(),
        vec!["a", "c", "b"]
    );
    let mut old = serde_json::to_value(&r).unwrap();
    old.as_object_mut().unwrap().remove("topArtists");
    old.as_object_mut().unwrap().remove("topAlbums");
    old["topAlbum"].as_object_mut().unwrap().remove("trackId");
    let restored: Recap = serde_json::from_value(old).unwrap();
    assert!(restored.top_artists.is_empty());
    assert!(restored.top_albums.is_empty());
    assert_eq!(restored.top_artist.unwrap().name, "Zed");
}
