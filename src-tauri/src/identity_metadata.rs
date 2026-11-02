//! Bounded, cancellable legacy identity reads. Never hold the catalog lock during I/O.
use music_core::{Store, Track};
use std::sync::{Arc, Mutex};
use tauri::Manager;
pub fn launch(
    app: tauri::AppHandle,
    core: Arc<Mutex<Store>>,
    snapshot: Arc<Mutex<music_core::PlaybackSnapshot>>,
) {
    std::thread::spawn(move || {
        let mut revision = None;
        let mut attempted = std::collections::BTreeSet::new();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let Some(main) = app.get_webview_window("main") else {
                break;
            };
            if !main.is_visible().unwrap_or(false)
                || main.is_minimized().unwrap_or(false)
                || snapshot.lock().map_or(true, |p| p.playing)
            {
                continue;
            }
            let current = match core.lock() {
                Ok(s) => s.catalog_version(),
                Err(_) => break,
            };
            if revision == Some(current) {
                continue;
            }
            revision = Some(current);
            let jobs = match core.lock() {
                Ok(s) => s
                    .all_tracks()
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|t| {
                        !t.demo
                            && t.available
                            && !t.identity.identity_metadata_read
                            && !attempted.contains(&t.id)
                    })
                    .take(8)
                    .collect::<Vec<_>>(),
                Err(_) => break,
            };
            if jobs.len() == 8 {
                revision = None;
            }
            for old in jobs {
                if snapshot.lock().map_or(true, |p| p.playing)
                    || !main.is_visible().unwrap_or(false)
                    || main.is_minimized().unwrap_or(false)
                {
                    revision = None;
                    break;
                }
                attempted.insert(old.id.clone());
                let result = read(&old, &app);
                if result
                    .as_ref()
                    .err()
                    .is_some_and(|e| e.contains("deferred"))
                {
                    attempted.remove(&old.id);
                    revision = None;
                    break;
                }
                if let Ok(identity) = result {
                    if let Ok(mut s) = core.lock() {
                        if let Ok(Some(mut current)) = s.track(&old.id) {
                            if current.source_uri == old.source_uri
                                && !current.identity.identity_metadata_read
                            {
                                let affects_index = current.identity.artist_names
                                    != identity.artist_names
                                    || current.identity.album_artist != identity.album_artist;
                                current.identity.artist_names = identity.artist_names;
                                current.identity.album_artist = identity.album_artist;
                                current.identity.identity_metadata_read = true;
                                if s.upsert_track(&current).is_ok() && affects_index {
                                    use tauri::Emitter;
                                    let _ = app.emit("library://metadata", &current.id);
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}
fn read(t: &Track, app: &tauri::AppHandle) -> Result<music_core::identity::TrackIdentity, String> {
    #[cfg(not(target_os = "android"))]
    {
        use lofty::{config::ParseOptions, file::TaggedFileExt, probe::Probe, tag::ItemKey};
        let _ = app;
        let tagged = Probe::open(&t.source_uri)
            .map_err(|e| e.to_string())?
            .options(
                ParseOptions::new()
                    .read_cover_art(false)
                    .read_properties(false),
            )
            .read()
            .map_err(|e| e.to_string())?;
        let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
        Ok(music_core::identity::TrackIdentity {
            artist_names: tag
                .map(|t| {
                    t.get_strings(&ItemKey::TrackArtists)
                        .flat_map(|s| s.split(';'))
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned)
                        .collect()
                })
                .unwrap_or_default(),
            album_artist: tag
                .and_then(|t| t.get_string(&ItemKey::AlbumArtist))
                .map(str::to_owned),
            identity_metadata_read: true,
            ..Default::default()
        })
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        let value: serde_json::Value = app.native_music().call(
            "albumOrder",
            serde_json::json!({"uri":t.source_uri,"idle":true}),
        )?;
        let mut identity: music_core::identity::TrackIdentity =
            serde_json::from_value(value).map_err(|e| e.to_string())?;
        identity.identity_metadata_read = true;
        Ok(identity)
    }
}
