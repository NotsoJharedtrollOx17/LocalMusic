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
