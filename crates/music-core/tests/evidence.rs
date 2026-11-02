use chrono::{TimeZone, Utc};
use chrono_tz::America::Los_Angeles;
use music_core::*;
fn track(id: &str, artist: &str) -> Track {
    Track {
        identity: Default::default(),
        id: id.into(),
        title: id.into(),
        artist: artist.into(),
        album: "Album".into(),
        genre: "Rock".into(),
        duration_ms: 60000,
        source_uri: format!("/private/{id}"),
        artwork_url: None,
        release_year: None,
        release_metadata_read: true,
        track_number: None,
        disc_number: None,
        order_metadata_read: true,
        favorite: false,
        available: true,
        demo: false,
        hidden: false,
    }
}
fn settings() -> Settings {
    Settings {
        language: "en".into(),
        theme: "system".into(),
        time_zone: "UTC".into(),
        history_enabled_since: "2025-01-01T00:00:00Z".into(),
        privacy_revision: 0,
        recap_period: RecapKind::Year,
        visualizer_mode: None,
        playlist_blend: None,
    }
}
#[test]
fn library_removal_preserves_history_and_restores_search() {
    let mut db = Store::open(":memory:").unwrap();
    let t = track("song", "Artist");
    db.upsert_track(&t).unwrap();
    let session = Session {
        id: "session".into(),
        track_id: t.id.clone(),
        started_at_utc: "2025-06-01T00:00:00Z".into(),
        played_ms: 40000,
        excluded: false,
        end_reason: None,
    };
    let interval = Interval {
        session_id: session.id.clone(),
        sequence: 0,
        start_utc: session.started_at_utc.clone(),
        played_ms: 40000,
    };
    db.ingest(&session, Some(&interval)).unwrap();
    db.save_playlist(&Playlist {
        id: "list".into(),
        title: "My music".into(),
        kind: "manual".into(),
        track_ids: vec![t.id.clone()],
    })
    .unwrap();
    db.set_library_visibility(&[t.id.clone()], false).unwrap();
    assert_eq!(db.tracks("", 0, 60).unwrap().total, 0);
    assert_eq!(db.groups("artists", 0, 60).unwrap().total, 0);
    assert!(db
        .tracks_with_options("Artist", 0, 60, false, "title")
        .unwrap()
        .tracks
        .is_empty());
    assert!(db.track(&t.id).unwrap().unwrap().hidden);
    let recap = recap::aggregate(
        &RecapRequest {
            kind: RecapKind::Year,
            anchor_date: "2025-01-01".into(),
        },
        &settings(),
        &db.all_tracks().unwrap(),
        &db.sessions().unwrap(),
        &db.intervals().unwrap(),
        Utc.with_ymd_and_hms(2025, 6, 2, 0, 0, 0).unwrap(),
    )
    .unwrap();
    assert_eq!(recap.listened_ms, 40000);
    assert_eq!(recap.top_tracks[0].track.id, t.id);
    assert!(recap.track_ids.is_empty());
    assert_eq!(db.playlists().unwrap()[0].track_ids, vec![t.id.clone()]);
    db.upsert_track(&t).unwrap(); // migration/favorite updates cannot unhide a song
    assert_eq!(db.tracks("", 0, 60).unwrap().total, 0);
    db.set_library_visibility(&[t.id.clone()], true).unwrap();
    let result = db
        .tracks_with_options("Artist", 0, 60, false, "title")
        .unwrap();
    assert_eq!(result.tracks.len(), 1);
    assert_eq!(
        db.groups_filtered("albums", 0, 60, "Artist").unwrap().total,
        1
    );
    assert_eq!(
        db.groups_filtered("artists", 0, 60, "Artist")
            .unwrap()
            .total,
        1
    );
    assert_eq!(db.sessions().unwrap()[0].played_ms, 40000);
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
    let a = recap::aggregate(
        &RecapRequest {
            kind: RecapKind::Year,
            anchor_date: "2025-01-01".into(),
        },
        &settings(),
        &ts,
        &ss,
        &intervals,
        now,
    )
    .unwrap();
    let b = recap::aggregate(
        &RecapRequest {
            kind: RecapKind::Year,
            anchor_date: "2026-01-01".into(),
        },
        &settings(),
        &ts,
        &ss,
        &intervals,
        now,
    )
    .unwrap();
    assert_eq!(a.listened_ms, 20000);
    assert_eq!(b.listened_ms, 20000);
    assert_eq!(a.qualified_plays, 1);
    assert_eq!(b.qualified_plays, 0);
    assert_eq!(a.buckets[11].listened_ms, 20000);
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
        blend: None,
        seed: None,
        title: "Mix".into(),
        target_count: None,
        target_minutes: Some(1),
        genre: "Rock".into(),
        include_artist: "".into(),
        exclude_artist: "A".into(),
        include_artists: vec![],
        exclude_artists: vec![],
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
    assert_eq!(
        db.group_ids("artists", "Artist 124", "").unwrap(),
        vec!["track-124"]
    );
    let mut another = track("track-125", "Artist 124");
    another.album = "Another Album".into();
    db.upsert_track(&another).unwrap();
    assert_eq!(db.group_ids("artists", "Artist 124", "").unwrap().len(), 2);
    assert_eq!(
        db.group_ids("albums", "Another Album", "Artist 124")
            .unwrap(),
        vec!["track-125"]
    );
    assert!(db.group_ids("invalid", "Artist 124", "").is_err());
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

#[test]
fn album_order_survives_grouping_and_catalog_pagination() {
    let mut db = Store::open(":memory:").unwrap();
    for (id, number, disc) in [
        ("Zulu opener", Some(1), None),
        ("Alpha finale", Some(10), Some(1)),
        ("Bonus", None, None),
        ("Disc two opener", Some(1), Some(2)),
        ("Disc two end", Some(2), Some(2)),
    ] {
        let mut t = track(id, "Artist");
        t.track_number = number;
        t.disc_number = disc;
        db.upsert_track(&t).unwrap();
    }
    let expected = vec![
        "Zulu opener",
        "Alpha finale",
        "Bonus",
        "Disc two opener",
        "Disc two end",
    ];
    assert_eq!(db.group_ids("albums", "Album", "Artist").unwrap(), expected);
    assert_eq!(db.group_ids("artists", "Artist", "").unwrap(), expected);
    assert_eq!(db.groups("albums", 0, 60).unwrap().groups[0].ids, expected);
    for sort in ["album", "artist"] {
        for (offset, id) in expected.iter().enumerate() {
            let page = db.tracks_with_options("", offset, 1, false, sort).unwrap();
            assert_eq!(page.tracks[0].id, *id);
        }
    }
    assert_eq!(
        db.tracks_with_options("", 0, 1, false, "title")
            .unwrap()
            .tracks[0]
            .id,
        "Alpha finale"
    );
    let mut other = track("Other album", "Artist");
    other.album = "A preceding album".into();
    db.upsert_track(&other).unwrap();
    assert_eq!(
        db.group_ids("artists", "Artist", "").unwrap()[0],
        "Other album"
    );
}
#[test]
fn old_track_records_remain_readable_without_order_tags() {
    let mut raw = serde_json::to_value(track("legacy", "Artist")).unwrap();
    for key in ["trackNumber", "discNumber", "orderMetadataRead"] {
        raw.as_object_mut().unwrap().remove(key);
    }
    let legacy: Track = serde_json::from_value(raw).unwrap();
    assert!(legacy.track_number.is_none());
    assert!(legacy.disc_number.is_none());
    assert!(!legacy.order_metadata_read);
}
