use music_core::identity::*;
use music_core::*;
use serde_json::{json, Value};
fn fixture() -> (Vec<Track>, Vec<Session>, Value) {
    let f: Value = serde_json::from_str(include_str!(
        "../../../tests/fixtures/library-identity.json"
    ))
    .unwrap();
    (
        serde_json::from_value(f["tracks"].clone()).unwrap(),
        serde_json::from_value(f["sessions"].clone()).unwrap(),
        f,
    )
}
#[test]
fn shared_identity_candidates_and_conservative_artist_rules() {
    let (tracks, _, f) = fixture();
    for (id, name) in f["leads"].as_object().unwrap() {
        assert_eq!(
            lead(tracks.iter().find(|t| &t.id == id).unwrap()),
            name.as_str().unwrap()
        );
    }
    let (songs, albums) = candidates(&tracks, &Organization::default());
    assert!(songs
        .iter()
        .any(|c| c.ids.contains(&"a".into()) && c.ids.contains(&"b".into())));
    assert!(!songs.iter().any(|c| c.ids.contains(&"e".into())));
    assert!(albums.iter().any(
        |c| c.ids.contains(&base_album(&tracks[0])) && c.ids.contains(&base_album(&tracks[1]))
    ));
}
#[test]
fn links_preserve_sources_history_and_original_album_attribution() {
    let (tracks, sessions, _) = fixture();
    let mut store = Store::open(":memory:").unwrap();
    for t in &tracks {
        store.upsert_track(t).unwrap();
    }
    for s in &sessions {
        store.ingest(s, None).unwrap();
    }
    let raw = store.sessions().unwrap();
    let state = store
        .organize_library(0, json!({"op":"songLink","ids":["a","b"],"preferred":"b"}))
        .unwrap();
    assert!(store
        .organize_library(0, json!({"op":"songUnlink","id":state.songs[0].id}))
        .is_err());
    let request = RecapRequest {
        kind: RecapKind::Year,
        anchor_date: "2026-01-01".into(),
    };
    let mut settings = Settings::default();
    settings.history_enabled_since = "2026-01-01T00:00:00Z".into();
    let now = "2026-02-01T00:00:00Z".parse().unwrap();
    let split = recap::aggregate(
        &request,
        &settings,
        &store.all_tracks().unwrap(),
        &sessions,
        &[],
        now,
    )
    .unwrap();
    assert_eq!(split.qualified_plays, 2);
    assert_eq!(split.top_tracks[0].track.id, "b");
    assert_eq!(
        split.top_albums.iter().map(|a| a.plays).collect::<Vec<_>>(),
        vec![1, 1]
    );
    let next=store.organize_library(1,json!({"op":"albumLink","keys":[base_album(&tracks[0]),base_album(&tracks[1])],"title":"Canonical","artist":"Lead","coverId":"a"})).unwrap();
    let r = recap::aggregate(
        &request,
        &settings,
        &store.all_tracks().unwrap(),
        &sessions,
        &[],
        now,
    )
    .unwrap();
    assert_eq!(r.top_albums[0].name, "Canonical");
    assert_eq!(r.top_albums[0].plays, 2);
    assert_eq!(r.top_artists[0].name, "Lead");
    assert_eq!(
        serde_json::to_value(raw).unwrap(),
        serde_json::to_value(store.sessions().unwrap()).unwrap()
    );
    let original = store.track("a").unwrap().unwrap();
    assert_eq!(original.artist, "Lead feat. Guest");
    assert_eq!(original.album, "First");
    let groups = store.groups("albums", 0, 60).unwrap();
    let album = groups
        .groups
        .iter()
        .find(|g| g.title == "Canonical")
        .unwrap();
    assert_eq!(album.ids.len(), 3);
    let stable = album.id.clone();
    store.organize_library(2,json!({"op":"albumLink","keys":next.albums[0].keys,"title":"Renamed","artist":"Lead","coverId":"b"})).unwrap();
    assert_eq!(
        store
            .groups_filtered("albums", 0, 60, "First album")
            .unwrap()
            .groups[0]
            .id,
        stable
    );
    store
        .organize_library(3, json!({"op":"albumUnlink","id":stable}))
        .unwrap();
    assert!(store
        .groups_filtered("albums", 0, 60, "Canonical")
        .unwrap()
        .groups
        .is_empty());
    store
        .organize_library(4, json!({"op":"songUnlink","id":state.songs[0].id}))
        .unwrap();
    assert!(store
        .track("a")
        .unwrap()
        .unwrap()
        .identity
        .song_identity
        .is_none());
}
#[test]
fn corrections_survive_reimport_and_history_deletion_and_manual_additions_reject_links() {
    let (tracks, _, _) = fixture();
    let mut store = Store::open(":memory:").unwrap();
    for t in &tracks {
        store.upsert_track(t).unwrap();
    }
    let p = Playlist {
        id: "p".into(),
        title: "Saved".into(),
        kind: "manual".into(),
        track_ids: vec!["a".into()],
    };
    store.save_playlist(&p).unwrap();
    store
        .organize_library(0, json!({"op":"songLink","ids":["a","b"],"preferred":"b"}))
        .unwrap();
    let mut duplicate = p.clone();
    duplicate.track_ids.push("b".into());
    assert!(store.save_playlist(&duplicate).is_err());
    store
        .organize_library(1, json!({"op":"artist","ids":["g"],"name":"Corrected"}))
        .unwrap();
    store.upsert_track(&tracks[6]).unwrap();
    assert_eq!(lead(&store.track("g").unwrap().unwrap()), "Corrected");
    store.delete_history().unwrap();
    assert_eq!(store.organization().unwrap().songs.len(), 1);
}
#[test]
fn failed_organization_write_is_atomic_and_reopen_is_idempotent() {
    let (tracks, _, _) = fixture();
    let path = std::env::temp_dir().join(format!("identity-{}.sqlite", uuid::Uuid::new_v4()));
    {
        let mut store = Store::open(&path).unwrap();
        for t in &tracks {
            store.upsert_track(t).unwrap();
        }
        store.connection.execute_batch("CREATE TRIGGER fail_identity BEFORE UPDATE ON library_identity BEGIN SELECT RAISE(ABORT,'disk failure'); END;").unwrap();
        assert!(store
            .organize_library(0, json!({"op":"artist","ids":["a"],"name":"Changed"}))
            .is_err());
        assert_eq!(store.organization().unwrap().revision, 0);
        assert_eq!(lead(&store.track("a").unwrap().unwrap()), "Lead");
        store
            .connection
            .execute_batch("DROP TRIGGER fail_identity;")
            .unwrap();
        store
            .organize_library(0, json!({"op":"artist","ids":["a"],"name":"Changed"}))
            .unwrap();
    }
    {
        let store = Store::open(&path).unwrap();
        assert_eq!(store.organization().unwrap().revision, 1);
        assert_eq!(lead(&store.track("a").unwrap().unwrap()), "Changed");
        assert_eq!(store.all_tracks().unwrap().len(), tracks.len());
    }
    let _ = std::fs::remove_file(path);
}

#[test]
fn playback_batch_preserves_order_corrections_duplicates_and_visibility() {
    let (tracks, _, _) = fixture();
    let mut store = Store::open(":memory:").unwrap();
    for t in &tracks {
        store.upsert_track(t).unwrap();
    }
    store
        .organize_library(0, json!({"op":"artist","ids":["a"],"name":"Corrected"}))
        .unwrap();
    store
        .connection
        .execute("INSERT INTO hidden_tracks(track_id) VALUES (?1)", ["b"])
        .unwrap();
    let ids: Vec<String> = ["a", "missing", "b", "g", "a"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    let batch = store.playback_tracks(&ids).unwrap();
    assert_eq!(
        batch.iter().map(|(id, _)| id.as_str()).collect::<Vec<_>>(),
        vec!["a", "g", "a"]
    );
    for (id, track) in batch {
        assert_eq!(
            serde_json::to_value(track).unwrap(),
            serde_json::to_value(store.track(&id).unwrap().unwrap()).unwrap()
        );
    }
    assert!(store.playback_tracks(&[]).unwrap().is_empty());
}
