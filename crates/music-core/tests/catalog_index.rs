use music_core::*;
use serde_json::Value;

#[test]
fn complete_index_has_consistent_membership_without_media_payloads() {
    let fixture: Value =
        serde_json::from_str(include_str!("../../../tests/fixtures/catalog-index.json")).unwrap();
    for size in fixture["sizes"].as_array().unwrap() {
        let size = size.as_u64().unwrap() as usize;
        let mut store = Store::open(":memory:").unwrap();
        let template: Track = serde_json::from_value(fixture["track"].clone()).unwrap();
        for i in 0..size {
            let mut t = template.clone();
            t.id = format!("index-{i:05}");
            t.title = format!("Song {i:05}");
            t.album = format!("Album {:04}", i / 10);
            store.upsert_track(&t).unwrap();
        }
        let index = store.catalog_index().unwrap();
        assert_eq!(index.tracks.len(), size);
        assert_eq!(index.revision, store.catalog_version());
        assert_eq!(
            index.tracks.last().unwrap().title,
            format!("Song {:05}", size - 1)
        );
        assert!(index
            .tracks
            .iter()
            .all(|t| t.source_uri.is_empty() && t.artwork_url.is_none()));
        let ids: std::collections::HashSet<_> = index.tracks.iter().map(|t| &t.id).collect();
        for g in index.albums.iter().chain(index.artists.iter()) {
            assert!(ids.contains(&g.cover_track_id));
            assert!(g.ids.iter().all(|id| ids.contains(id)));
        }
        assert_eq!(
            index.albums.iter().map(|g| g.ids.len()).sum::<usize>(),
            size
        );
        store
            .set_library_visibility(&["index-00000".into()], false)
            .unwrap();
        let changed = store.catalog_index().unwrap();
        assert!(changed.revision > index.revision);
        assert_eq!(changed.tracks.len(), size - 1);
        // The display snapshot never rewrites authoritative source metadata.
        assert_eq!(
            store.track("index-00000").unwrap().unwrap().source_uri,
            template.source_uri
        );
    }
}
