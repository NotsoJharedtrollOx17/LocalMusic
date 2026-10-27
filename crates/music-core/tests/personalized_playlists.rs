use music_core::{
    recommendation::{self, RecommendationData},
    *,
};
use serde_json::Value;
#[test]
fn shared_personalized_fixtures() {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/personalized-playlists.json"
    ))
    .unwrap();
    for c in f["cases"].as_array().unwrap() {
        let mut tracks: Vec<Track> = serde_json::from_value(f["tracks"].clone()).unwrap();
        if c["favorites"] == false {
            for t in &mut tracks {
                t.favorite = false;
            }
        }
        let sessions: Vec<Session> =
            serde_json::from_value(c.get("sessions").unwrap_or(&f["sessions"]).clone()).unwrap();
        let request: PlaylistRequest = serde_json::from_value(c["request"].clone()).unwrap();
        let mut data: RecommendationData = serde_json::from_value(f["data"].clone()).unwrap();
        if let Some(less) = c.get("less") {
            data.less = serde_json::from_value(less.clone()).unwrap();
        }
        let result = recommendation::generate(
            &request,
            &tracks,
            &sessions,
            f["zone"].as_str().unwrap(),
            f["now"].as_str().unwrap().parse().unwrap(),
            &data,
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(&result.playlist.track_ids).unwrap(),
            c["expectedIds"],
            "{}",
            c["name"]
        );
        assert_eq!(
            result.recommendation.unwrap().source,
            c["source"].as_str().unwrap()
        );
    }
}
#[test]
fn descriptors_feedback_and_history_have_separate_lifetimes() {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/personalized-playlists.json"
    ))
    .unwrap();
    let mut store = Store::open(":memory:").unwrap();
    let mut track: Track = serde_json::from_value(f["tracks"][0].clone()).unwrap();
    store.upsert_track(&track).unwrap();
    store.suggestion_feedback(&track.id, true).unwrap();
    store.suggestion_feedback(&track.id, true).unwrap();
    let mut feature: recommendation::AcousticFeature =
        serde_json::from_value(f["data"]["features"]["t00"].clone()).unwrap();
    feature.fingerprint = store.acoustic_fingerprint(&track).unwrap();
    store.save_acoustic(&track.id, &feature).unwrap();
    store.delete_history().unwrap();
    let data = store.recommendation_data().unwrap();
    assert_eq!(data.less, vec![track.id.clone()]);
    assert_eq!(data.features.len(), 1);
    track.duration_ms += 1;
    store.upsert_track(&track).unwrap();
    assert!(store.recommendation_data().unwrap().features.is_empty());
    assert!(store.save_acoustic(&track.id, &feature).is_err());
    store.suggestion_feedback(&track.id, false).unwrap();
    assert!(store.recommendation_data().unwrap().less.is_empty());
    assert!(store.sessions().unwrap().is_empty());
    store
        .connection
        .execute("UPDATE acoustic_features SET data='invalid json'", [])
        .unwrap();
    assert!(store.recommendation_data().unwrap().features.is_empty());
}
#[test]
fn shared_pcm_descriptors() {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/acoustic-analysis.json"
    ))
    .unwrap();
    for c in f["cases"].as_array().unwrap() {
        let rate = c["rate"].as_u64().unwrap() as u32;
        let channels: Vec<Vec<f32>> = c["frequencies"]
            .as_array()
            .unwrap()
            .iter()
            .enumerate()
            .map(|(i, v)| {
                let mut seed = 17u32;
                (0..16384)
                    .map(|n| {
                        if v.as_f64() == Some(-1.0) {
                            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                            return ((seed as f64 / 4294967296.0 - 0.5) * 0.2) as f32;
                        }
                        if v.as_f64() == Some(-2.0) {
                            return if n == 9216 { 0.2 } else { 0.0 };
                        }
                        (c["phases"][i].as_f64().unwrap()
                            * 0.2
                            * (2.0 * std::f64::consts::PI * n as f64 * v.as_f64().unwrap()
                                / rate as f64)
                                .sin()) as f32
                    })
                    .collect()
            })
            .collect();
        let mut a = music_core::acoustic::AcousticAnalysis::default();
        a.add(&channels, rate);
        let actual = a.finish("fixture".into());
        if c["name"] == "silence" {
            assert!(actual.is_none());
            continue;
        }
        let actual = actual.unwrap();
        assert!(actual.valid());
        for (i, b) in actual.bands.iter().enumerate() {
            if let Some(expected) = c.get("expectedBands") {
                assert!(
                    (b - expected[i].as_f64().unwrap()).abs() < 1e-7,
                    "{} band {}",
                    c["name"],
                    i
                );
            }
        }
    }
}

#[test]
fn explicit_artist_can_fill_mix_without_relaxing_other_filters() {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/personalized-playlists.json"
    ))
    .unwrap();
    let mut tracks: Vec<Track> = serde_json::from_value(f["tracks"].clone()).unwrap();
    tracks.truncate(5);
    for t in &mut tracks {
        t.artist = "A".into();
    }
    let mut req: PlaylistRequest =
        serde_json::from_value(f["cases"][1]["request"].clone()).unwrap();
    req.target_count = Some(5);
    let data: RecommendationData = serde_json::from_value(f["data"].clone()).unwrap();
    let now = f["now"].as_str().unwrap().parse().unwrap();
    let generate = |r: &PlaylistRequest| {
        recommendation::generate(r, &tracks, &[], "UTC", now, &data)
            .unwrap()
            .playlist
            .track_ids
            .len()
    };
    assert_eq!(generate(&req), 2);
    req.include_artist = " A ".into();
    assert_eq!(generate(&req), 5);
    assert_eq!(
        music_core::playlist::generate(&req, &tracks, &[], "UTC", now)
            .unwrap()
            .track_ids
            .len(),
        5
    );
    req.exclude_artist = "A".into();
    assert_eq!(generate(&req), 0);
    assert_eq!(
        music_core::playlist::generate(&req, &tracks, &[], "UTC", now)
            .unwrap()
            .track_ids
            .len(),
        0
    );
}

#[test]
fn shared_multi_artist_fixtures() {
    let base: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/personalized-playlists.json"
    ))
    .unwrap();
    let multi: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/multi-artist-playlists.json"
    ))
    .unwrap();
    let template: Track = serde_json::from_value(base["tracks"][0].clone()).unwrap();
    let mut tracks = Vec::new();
    for artist in multi["artists"].as_array().unwrap() {
        for _ in 0..3 {
            let mut t = template.clone();
            t.id = format!("m{:02}", tracks.len());
            t.artist = artist.as_str().unwrap().into();
            tracks.push(t);
        }
    }
    let now = base["now"].as_str().unwrap().parse().unwrap();
    for c in multi["cases"].as_array().unwrap() {
        let mut request: PlaylistRequest =
            serde_json::from_value(base["cases"][0]["request"].clone()).unwrap();
        request.include_artist = c["includeArtist"].as_str().unwrap().into();
        request.include_artists = serde_json::from_value(c["includeArtists"].clone()).unwrap();
        request.exclude_artist = c["excludeArtist"].as_str().unwrap().into();
        request.exclude_artists = serde_json::from_value(c["excludeArtists"].clone()).unwrap();
        request.target_count = Some(c["targetCount"].as_u64().unwrap() as usize);
        let generated = recommendation::generate(
            &request,
            &tracks,
            &[],
            "UTC",
            now,
            &RecommendationData::default(),
        )
        .unwrap();
        assert_eq!(
            serde_json::to_value(generated.playlist.track_ids).unwrap(),
            c["expectedIds"],
            "{}",
            c["name"]
        );
        let legacy = music_core::playlist::generate(&request, &tracks, &[], "UTC", now).unwrap();
        assert_eq!(
            serde_json::to_value(legacy.track_ids).unwrap(),
            c["expectedLegacyIds"],
            "{}",
            c["name"]
        );
    }
}

#[test]
fn genre_is_a_preference_for_included_artists_and_a_filter_otherwise() {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/personalized-playlists.json"
    ))
    .unwrap();
    let template: Track = serde_json::from_value(f["tracks"][0].clone()).unwrap();
    let tracks: Vec<Track> = ["Alpha", "Beta", "Gamma"]
        .iter()
        .enumerate()
        .map(|(i, artist)| {
            let mut t = template.clone();
            t.id = format!("genre-{i}");
            t.artist = (*artist).into();
            t.genre = if i == 0 { "Rock" } else { "Jazz" }.into();
            t
        })
        .collect();
    let mut request: PlaylistRequest =
        serde_json::from_value(f["cases"][0]["request"].clone()).unwrap();
    request.include_artist = "Alpha".into();
    request.include_artists = vec!["Beta".into(), "Gamma".into()];
    request.exclude_artist.clear();
    request.genre = "Rock".into();
    request.target_count = Some(3);
    let now = f["now"].as_str().unwrap().parse().unwrap();
    let generate = |r: &PlaylistRequest| {
        recommendation::generate(r, &tracks, &[], "UTC", now, &RecommendationData::default())
            .unwrap()
            .playlist
            .track_ids
    };
    let ids = generate(&request);
    assert_eq!(ids.len(), 3);
    assert!(tracks.iter().all(|t| ids.contains(&t.id)));
    request.exclude_artist = "Beta".into();
    assert!(!generate(&request).contains(&"genre-1".into()));
    request.include_artist.clear();
    request.include_artists.clear();
    request.exclude_artist.clear();
    assert_eq!(generate(&request), vec!["genre-0"]);
}
