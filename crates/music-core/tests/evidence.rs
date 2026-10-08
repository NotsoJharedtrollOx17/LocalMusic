use chrono::{TimeZone, Utc};
use chrono_tz::America::Los_Angeles;
use music_core::*;
fn track(id: &str, artist: &str) -> Track {
    Track {
        id: id.into(),
        title: id.into(),
        artist: artist.into(),
        album: "Album".into(),
        genre: "Rock".into(),
        duration_ms: 60000,
        source_uri: format!("/private/{id}"),
        artwork_url: None,
        favorite: false,
        available: true,
        demo: false,
    }
}
fn settings() -> Settings {
    Settings {
        language: "en".into(),
        theme: "system".into(),
        time_zone: "UTC".into(),
        history_enabled_since: "2025-01-01T00:00:00Z".into(),
        privacy_revision: 0,
    }
}
#[test]
fn journal_replay_is_idempotent() {
    let mut db = Store::open(":memory:").unwrap();
    db.upsert_track(&track("a", "A")).unwrap();
    let s = Session {
        id: "s".into(),
        track_id: "a".into(),
        started_at_utc: "2025-06-01T00:00:00Z".into(),
        played_ms: 40000,
        excluded: false,
        end_reason: None,
    };
    let i = Interval {
        session_id: "s".into(),
        sequence: 0,
        start_utc: s.started_at_utc.clone(),
        played_ms: 40000,
    };
    db.ingest(&s, Some(&i)).unwrap();
    db.ingest(&s, Some(&i)).unwrap();
    assert_eq!(db.intervals().unwrap().len(), 1);
    assert_eq!(db.sessions().unwrap()[0].played_ms, 40000);
}
#[test]
fn recap_splits_year_and_excludes_private() {
    let ts = vec![track("a", "A"), track("b", "B")];
    let ss = vec![
        Session {
            id: "s".into(),
            track_id: "a".into(),
            started_at_utc: "2025-12-31T23:59:40Z".into(),
            played_ms: 40000,
            excluded: false,
            end_reason: None,
        },
        Session {
            id: "p".into(),
            track_id: "b".into(),
            started_at_utc: "2025-12-31T22:00:00Z".into(),
            played_ms: 60000,
            excluded: true,
            end_reason: None,
        },
    ];
    let intervals = ss
        .iter()
        .map(|s| Interval {
            session_id: s.id.clone(),
            sequence: 0,
            start_utc: s.started_at_utc.clone(),
            played_ms: s.played_ms,
        })
        .collect::<Vec<_>>();
    let now = Utc.with_ymd_and_hms(2026, 2, 1, 0, 0, 0).unwrap();
    let a = recap::aggregate(2025, &settings(), &ts, &ss, &intervals, now).unwrap();
    let b = recap::aggregate(2026, &settings(), &ts, &ss, &intervals, now).unwrap();
    assert_eq!(a.listened_ms, 20000);
    assert_eq!(b.listened_ms, 20000);
    assert_eq!(a.qualified_plays, 1);
    assert_eq!(b.qualified_plays, 0);
    assert_eq!(a.months[11], 20000);
}
#[test]
fn dst_day_has_23_hours() {
    let a = recap::midnight(Los_Angeles, 2025, 3, 9).unwrap();
    let b = recap::midnight(Los_Angeles, 2025, 3, 10).unwrap();
    assert_eq!((b - a).num_hours(), 23);
}
#[test]
fn search_is_paged_and_treats_input_as_text() {
    let mut db = Store::open(":memory:").unwrap();
    db.upsert_track(&track("a", "Radiohead")).unwrap();
    db.upsert_track(&track("b", "Muse")).unwrap();
    assert_eq!(db.tracks("Radio", 0, 60).unwrap().total, 1);
    assert_eq!(db.tracks("\" OR 1=1", 0, 60).unwrap().total, 0);
    assert_eq!(db.tracks("", 0, 1).unwrap().tracks.len(), 1);
}
#[test]
fn excluded_artist_and_budget_are_hard_constraints() {
    let req = PlaylistRequest {
        title: "Mix".into(),
        target_count: None,
        target_minutes: Some(1),
        genre: "Rock".into(),
        include_artist: "".into(),
        exclude_artist: "A".into(),
        prefer_favorites: false,
        avoid_heard_today: false,
    };
    let mut unavailable = track("c", "B");
    unavailable.available = false;
    let p = playlist::generate(
        &req,
        &[track("a", "A"), track("b", "B"), unavailable],
        &[],
        "UTC",
        Utc::now(),
    )
    .unwrap();
    assert_eq!(p.track_ids, vec!["b"]);
}
#[test]
fn artist_caps_and_reimport_preserve_history() {
    let mut db = Store::open(":memory:").unwrap();
    let a = track("stable", "Artist");
    db.upsert_track(&a).unwrap();
    let s = Session {
        id: "s".into(),
        track_id: a.id.clone(),
        started_at_utc: "2025-01-01T00:00:00Z".into(),
        played_ms: 30000,
        excluded: false,
        end_reason: None,
    };
    db.ingest(&s, None).unwrap();
    let mut moved = a.clone();
    moved.source_uri = "/new/location".into();
    db.upsert_track(&moved).unwrap();
    assert_eq!(db.all_tracks().unwrap().len(), 1);
    assert_eq!(db.sessions().unwrap()[0].track_id, "stable");
}
#[test]
fn delete_history_keeps_music_and_playlists() {
    let mut db = Store::open(":memory:").unwrap();
    db.upsert_track(&track("a", "A")).unwrap();
    db.save_playlist(&Playlist {
        id: "p".into(),
        title: "My mix".into(),
        kind: "manual".into(),
        track_ids: vec!["a".into()],
    })
    .unwrap();
    db.delete_history().unwrap();
    assert_eq!(db.all_tracks().unwrap().len(), 1);
    assert_eq!(db.playlists().unwrap().len(), 1);
    assert!(db.sessions().unwrap().is_empty());
}

#[test]
fn catalog_filters_and_groups_span_pages() {
    let mut db = Store::open(":memory:").unwrap();
    for n in 0..125 {
        let mut t = track(&format!("track-{n:03}"), &format!("Artist {n:03}"));
        t.album = format!("Album {}", n / 5);
        t.favorite = n >= 120;
        db.upsert_track(&t).unwrap();
    }
    let f = db.tracks_with_options("", 0, 60, true, "title").unwrap();
    assert_eq!(f.total, 5);
    assert_eq!(f.tracks[0].id, "track-120");
    assert_eq!(
        db.tracks_with_options("Artist 124", 0, 60, false, "artist")
            .unwrap()
            .total,
        1
    );
    assert_eq!(db.groups("artists", 60, 60).unwrap().groups.len(), 60);
    assert_eq!(db.groups("albums", 0, 60).unwrap().groups[0].ids.len(), 1);
    assert!(db
        .tracks_with_options("", 0, 60, false, "title;DROP TABLE tracks")
        .is_err());
}
#[test]
fn privacy_revision_changes_once_on_journal_replay() {
    let mut db = Store::open(":memory:").unwrap();
    db.upsert_track(&track("a", "A")).unwrap();
    let mut s = Session {
        id: "private".into(),
        track_id: "a".into(),
        started_at_utc: "2025-01-01T00:00:00Z".into(),
        played_ms: 40000,
        excluded: false,
        end_reason: None,
    };
    db.ingest(&s, None).unwrap();
    s.excluded = true;
    db.ingest(&s, None).unwrap();
    db.ingest(&s, None).unwrap();
    assert_eq!(
        db.get_setting::<Settings>("preferences")
            .unwrap()
            .unwrap()
            .privacy_revision,
        1
    );
}

#[test]
fn unavailable_track_update_does_not_steal_reassigned_alias() {
    let mut db = Store::open(":memory:").unwrap();
    let mut old = track("old", "A");
    old.source_uri = "/same/file".into();
    db.upsert_track(&old).unwrap();
    let mut next = track("new", "B");
    next.source_uri = old.source_uri.clone();
    db.upsert_track(&next).unwrap();
    old.available = false;
    db.upsert_track(&old).unwrap();
    assert!(db.source_uris("old").unwrap().is_empty());
    assert_eq!(db.source_uris("new").unwrap(), vec!["/same/file"]);
}
