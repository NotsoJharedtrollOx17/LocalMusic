use music_core::{automatic_playlists, Interval, Session, Store, Track};
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    tracks: Vec<Track>,
    sessions: Vec<Session>,
    intervals: Vec<Interval>,
    added_ids: Vec<String>,
    expected: Vec<Vec<String>>,
}
fn fixture() -> Fixture {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/automatic-playlists.json"
    ))
    .unwrap()
}
#[test]
fn shared_ordering_and_privacy_fixture() {
    let f = fixture();
    let lists = automatic_playlists::build(&f.tracks, &f.sessions, &f.intervals, &f.added_ids);
    assert_eq!(
        lists
            .iter()
            .map(|p| p.track_ids.clone())
            .collect::<Vec<_>>(),
        f.expected
    );
    assert!(lists.iter().all(|p| p.kind == "automatic"));
}
#[test]
fn first_import_order_survives_reimport_and_visibility_updates() {
    let mut db = Store::open(":memory:").unwrap();
    let f = fixture();
    for t in &f.tracks[..3] {
        db.upsert_track(t).unwrap();
    }
    db.upsert_track(&f.tracks[0]).unwrap();
    assert_eq!(
        db.automatic_playlists().unwrap()[0].track_ids,
        vec!["c", "b", "a"]
    );
    db.set_library_visibility(&["b".into()], false).unwrap();
    assert_eq!(
        db.automatic_playlists().unwrap()[0].track_ids,
        vec!["c", "a"]
    );
    db.set_library_visibility(&["b".into()], true).unwrap();
    let lists = db.automatic_playlists().unwrap();
    assert_eq!(lists[0].track_ids, vec!["c", "b", "a"]);
    assert!(db.save_playlist(&lists[0]).is_err());
    assert!(db.delete_playlist(&lists[0].id).is_err());
    assert!(db.playlists().unwrap().is_empty());
}
