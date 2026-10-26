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
