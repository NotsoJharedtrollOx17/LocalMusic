use chrono::{DateTime, Utc};
use music_core::*;
use serde_json::{json, Value};
#[test]
fn shared_calendar_fixtures() {
    let cases: Vec<Value> =
        serde_json::from_str(include_str!("../../../tests/fixtures/recap-periods.json")).unwrap();
    for f in cases {
        let request: RecapRequest = serde_json::from_value(f["request"].clone()).unwrap();
        let settings = Settings {
            time_zone: f["timeZone"].as_str().unwrap().into(),
            history_enabled_since: f["history"].as_str().unwrap().into(),
            ..Default::default()
        };
        let track:Track=serde_json::from_value(json!({"id":"a","title":"Song","artist":"Artist","album":"Album","genre":"","durationMs":60000,"sourceUri":"/private/audio.mp3","favorite":false,"available":true,"demo":false})).unwrap();
        let session = Session {
            id: "s".into(),
            track_id: "a".into(),
            started_at_utc: f["start"].as_str().unwrap().into(),
            played_ms: f["playedMs"].as_u64().unwrap(),
            excluded: f["excluded"].as_bool().unwrap_or(false),
            end_reason: None,
        };
        let interval = Interval {
            session_id: "s".into(),
            sequence: 0,
            start_utc: session.started_at_utc.clone(),
            played_ms: session.played_ms,
        };
        let now: DateTime<Utc> = f["now"].as_str().unwrap().parse().unwrap();
        let r =
            recap::aggregate(&request, &settings, &[track], &[session], &[interval], now).unwrap();
        let e = &f["expected"];
        let name = f["name"].as_str().unwrap();
        assert_eq!(
            r.period.start_date,
            e["startDate"].as_str().unwrap(),
            "{name}"
        );
        assert_eq!(r.period.end_date, e["endDate"].as_str().unwrap(), "{name}");
        assert_eq!(r.listened_ms, e["listenedMs"].as_u64().unwrap(), "{name}");
        assert_eq!(
            r.active_days,
            e["activeDays"].as_u64().unwrap() as usize,
            "{name}"
        );
        assert_eq!(
            r.qualified_plays,
            e["qualifiedPlays"].as_u64().unwrap(),
            "{name}"
        );
        assert_eq!(
            r.buckets.len(),
            e["bucketCount"].as_u64().unwrap() as usize,
            "{name}"
        );
        assert_eq!(
            r.buckets.iter().filter(|b| b.observed).count(),
            e["observedCount"].as_u64().unwrap() as usize,
            "{name}"
        );
        assert_eq!(
            r.buckets.iter().map(|b| b.listened_ms).sum::<u64>(),
            r.listened_ms
        );
        assert!(r.covered_from <= r.covered_through);
    }
}
#[test]
fn snapshot_compatibility_is_read_only_and_new_snapshots_round_trip() {
    let store = Store::open(":memory:").unwrap();
    let legacy = json!({"schemaVersion":1,"year":2025,"timeZone":"UTC","coveredFrom":"2025-01-01T00:00:00Z","coveredThrough":"2026-01-01T00:00:00Z","completeYear":true,"months":[0,0,0,0,0,0,0,0,0,0,0,0],"listenedMs":0,"qualifiedPlays":0,"activeDays":0,"topTracks":[],"topArtist":null,"topAlbum":null,"trackIds":[],"visualSeed":"original"});
    let r = recap::decode_snapshot(legacy.clone()).unwrap();
    assert_eq!(r.schema_version, 2);
    assert_eq!(r.visual_seed, "original");
    assert_eq!(legacy["schemaVersion"], 1);
    assert!(r.complete_period);
    store.save_snapshot(&r).unwrap();
    let saved = store.snapshots().unwrap();
    assert_eq!(
        serde_json::to_value(&saved[0]).unwrap(),
        serde_json::to_value(r).unwrap()
    );
    let settings:Settings=serde_json::from_value(json!({"language":"en","theme":"system","timeZone":"UTC","historyEnabledSince":"2020-01-01T00:00:00Z"})).unwrap();
    assert_eq!(settings.recap_period, RecapKind::Year);
}
#[test]
fn rejects_invalid_or_future_requests() {
    for date in ["2025-02-29", "2026-13-01", "bad"] {
        assert!(recap::period_for(&RecapRequest {
            kind: RecapKind::Month,
            anchor_date: date.into()
        })
        .is_err());
    }
    let request = RecapRequest {
        kind: RecapKind::Month,
        anchor_date: "2099-01-01".into(),
    };
    assert!(recap::aggregate(&request, &Settings::default(), &[], &[], &[], Utc::now()).is_err());
}
