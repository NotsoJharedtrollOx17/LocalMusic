use music_core::*;
use serde_json::Value;
#[test]
fn shared_scoped_search_and_revision_invalidation() {
    let f: Value =
        serde_json::from_str(include_str!("../../../tests/fixtures/scoped-search.json")).unwrap();
    for c in f["cases"].as_array().unwrap() {
        assert_eq!(
            search::matches(c["value"].as_str().unwrap(), c["query"].as_str().unwrap()),
            c["expected"].as_bool().unwrap(),
            "fixture: {c}"
        );
    }
    let mut store = Store::open(":memory:").unwrap();
    for track in f["tracks"].as_array().unwrap() {
        store
            .upsert_track(&serde_json::from_value::<Track>(track.clone()).unwrap())
            .unwrap();
    }
    let ids = vec!["second".into(), "first".into(), "missing".into()];
    assert_eq!(
        store.filter_track_ids(&ids, "BLUE").unwrap(),
        vec!["second", "first"]
    );
    assert_eq!(
        store
            .tracks_with_options("rain lines", 0, 60, true, "title")
            .unwrap()
            .total,
        1
    );
    assert_eq!(
        store
            .groups_filtered("albums", 0, 60, "blue quiet")
            .unwrap()
            .total,
        1
    );
    assert_eq!(
        store
            .groups_filtered("albums", 0, 60, "blue")
            .unwrap()
            .total,
        2
    );
    assert_eq!(
        store
            .groups_filtered("artists", 0, 60, "blue")
            .unwrap()
            .total,
        0
    );
    assert_eq!(
        store
            .tracks_with_options("%_", 0, 60, false, "title")
            .unwrap()
            .total,
        0
    );
    store
        .set_library_visibility(&["second".into()], false)
        .unwrap();
    assert_eq!(store.filter_track_ids(&ids, "blue").unwrap(), vec!["first"]);
    let mut track = store.track("first").unwrap().unwrap();
    track.album = "Amber".into();
    store.upsert_track(&track).unwrap();
    assert!(store.filter_track_ids(&ids, "blue").unwrap().is_empty());
    assert_eq!(
        store
            .groups_filtered("albums", 0, 60, "blue")
            .unwrap()
            .total,
        0
    );
    assert_eq!(
        store
            .groups_filtered("albums", 0, 60, "amber")
            .unwrap()
            .total,
        1
    );
    store
        .set_library_visibility(&["second".into()], true)
        .unwrap();
    assert_eq!(
        store.filter_track_ids(&ids, "blue").unwrap(),
        vec!["second"]
    );
}

#[test]
fn name_priority_precedes_paging_and_preserves_collection_order() {
    let f: Value =
        serde_json::from_str(include_str!("../../../tests/fixtures/scoped-search.json")).unwrap();
    for c in f["ranking"].as_array().unwrap() {
        assert_eq!(
            search::relevance(c["name"].as_str().unwrap(), c["query"].as_str().unwrap()),
            c["rank"].as_u64().unwrap() as u8
        );
    }
    let mut store = Store::open(":memory:").unwrap();
    for i in 0..70 {
        let mut track: Track = serde_json::from_value(f["tracks"][0].clone()).unwrap();
        track.id = format!("t{i:02}");
        track.title = match i {
            69 => "Rain",
            68 => "Rain falls",
            67 => "After rain",
            _ => "A metadata match",
        }
        .into();
        track.artist = format!("Rain artist {i:02}");
        track.album = track.title.clone();
        store.upsert_track(&track).unwrap();
    }
    for sort in ["title", "artist", "album"] {
        let page = store
            .tracks_with_options("rain", 0, 3, false, sort)
            .unwrap();
        assert_eq!(page.total, 70);
        assert_eq!(
            page.tracks
                .iter()
                .map(|t| t.id.as_str())
                .collect::<Vec<_>>(),
            vec!["t69", "t68", "t67"]
        );
        assert_eq!(
            store
                .tracks_with_options("rain", 3, 60, false, sort)
                .unwrap()
                .tracks
                .len(),
            60
        );
    }
    let albums = store.groups_filtered("albums", 0, 3, "rain").unwrap();
    assert_eq!(
        albums
            .groups
            .iter()
            .map(|g| g.title.as_str())
            .collect::<Vec<_>>(),
        vec!["Rain", "Rain falls", "After rain"]
    );
    let ids = vec!["t00".into(), "t67".into(), "t69".into()];
    assert_eq!(store.filter_track_ids(&ids, "rain").unwrap(), ids);
}
