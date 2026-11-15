use crate::state::{MusicState, Result};
#[cfg(not(target_os = "android"))]
use crate::{artwork, catalog};
use serde_json::json;
use std::sync::atomic::Ordering;
#[cfg(not(target_os = "android"))]
use tauri::Manager;
use tauri::{Emitter, State};

#[tauri::command]
pub(crate) async fn import_music(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    mode: String,
) -> Result<usize> {
    let core = state.core.clone();
    let cancel = state.cancel.clone();
    cancel.store(false, Ordering::Relaxed);
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::DialogExt;
        let app2 = app.clone();
        let cache = artwork::cache_dir(&app)?;
        let _ = mode;
        tauri::async_runtime::spawn_blocking(move || {
            let parent = app
                .get_webview_window("main")
                .ok_or("Main window unavailable")?;
            let folder = app
                .dialog()
                .file()
                .set_parent(&parent)
                .blocking_pick_folder();
            let Some(folder) = folder else { return Ok(0) };
            let _ = app2.emit("catalog://progress", json!({"imported":0,"failed":0}));
            let path = folder.into_path().map_err(|e| e.to_string())?;
            let mut n = 0usize;
            let mut failures = 0usize;
            for entry in walkdir::WalkDir::new(path)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if cancel.load(Ordering::Relaxed) {
                    break;
                }
                let p = entry.path();
                if !p.is_file() {
                    continue;
                }
                let ext = p
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if !["mp3", "flac", "wav", "m4a", "ogg", "opus", "aac"].contains(&ext.as_str()) {
                    continue;
                }
                let result = catalog::read_file(p, &cache).and_then(|mut track| {
                    let mut store = core.lock().map_err(|e| e.to_string())?;
                    let old = store.track(&track.id)?;
                    let is_new = old.as_ref().map_or(true, |old| old.hidden || !old.available);
                    if let Some(old) = old { track.favorite = old.favorite; }
                    store.upsert_track(&track)?;
                    store.set_library_visibility(&[track.id.clone()], true)?;
                    Ok(is_new)
                });
                match result {
                    Ok(true) => n += 1,
                    Ok(false) => {},
                    Err(_) => failures += 1,
                }
                if (n + failures) % 10 == 0 {
                    let _ = app2.emit(
                        "catalog://progress",
                        json!({"imported":n,"failed":failures}),
                    );
                }
                if (n + failures) % 25 == 0 {
                    let _ = artwork::prune(&cache, 128 * 1024 * 1024, None);
                }
            }
            catalog::reconcile(&mut *core.lock().map_err(|e| e.to_string())?)?;
            let _ = artwork::prune(&cache, 128 * 1024 * 1024, None);
            let _ = app2.emit(
                "catalog://progress",
                json!({"imported":n,"failed":failures}),
            );
            Ok(n)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        // Mobile channels live in Tauri's process-wide registry. Reuse one rather
        // than leaking a registered callback on every repeated library scan.
        static PROGRESS: std::sync::OnceLock<tauri::ipc::Channel<serde_json::Value>> =
            std::sync::OnceLock::new();
        let progress = PROGRESS.get_or_init(|| {
            let app = app.clone();
            tauri::ipc::Channel::new(move |body| {
                if let tauri::ipc::InvokeResponseBody::Json(value) = body {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&value) {
                        let _ = app.emit("catalog://progress", value);
                    }
                }
                Ok(())
            })
        });
        let known_ids: Vec<String> = core.lock().map_err(|e| e.to_string())?
            .all_tracks()?.into_iter().filter(|t| t.available && !t.hidden).map(|t| t.id).collect();
        let app2 = app.clone();
        let value: serde_json::Value = tauri::async_runtime::spawn_blocking(move || {
            app2.native_music()
                .call("importMusic", json!({"mode":mode,"progress":progress,"knownIds":known_ids}))
        })
        .await
        .map_err(|e| e.to_string())??;
        if value["manifestPath"].is_null() {
            let _ = app.emit(
                "catalog://progress",
                json!({"imported":0,"failed":0,"cancelled":true}),
            );
            return Ok(0);
        };
        let manifest = value["manifestPath"]
            .as_str()
            .ok_or("Invalid import response")?
            .to_owned();
        // File I/O and SQLite must not occupy an async runtime worker while
        // playback/journal and cancellation commands need that same runtime.
        tauri::async_runtime::spawn_blocking(move || {
            import_manifest(
                std::path::Path::new(&manifest),
                &core,
                &cancel,
                value["failed"].as_u64().unwrap_or(0) as usize,
                |count, failed| {
                    let _ = app.emit(
                        "catalog://progress",
                        json!({
                            "phase":"saving","imported":count,"failed":failed,
                            "scanned":value["scanned"],"total":value["ready"],
                            "cancelled":cancel.load(Ordering::Relaxed)
                        }),
                    );
                },
            )
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

#[cfg(any(target_os = "android", test))]
fn import_manifest(
    path: &std::path::Path,
    core: &std::sync::Mutex<music_core::Store>,
    cancel: &std::sync::atomic::AtomicBool,
    mut failed: usize,
    mut progress: impl FnMut(usize, usize),
) -> Result<usize> {
    use std::io::BufRead;
    struct Cleanup<'a>(&'a std::path::Path);
    impl Drop for Cleanup<'_> {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(self.0);
        }
    }
    let _cleanup = Cleanup(path);
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut count = 0;
    progress(count, failed);
    for (index, line) in std::io::BufReader::new(file).lines().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let line = line.map_err(|e| e.to_string())?;
        if let Ok(mut track) = serde_json::from_str::<music_core::Track>(&line) {
            let mut store = core.lock().map_err(|e| e.to_string())?;
            let old = store.track(&track.id)?;
            let is_new = old.as_ref().map_or(true, |old| old.hidden || !old.available);
            if let Some(old) = old { track.favorite = old.favorite; }
            store.upsert_track(&track)?;
            store.set_library_visibility(&[track.id.clone()], true)?;
            if is_new { count += 1; }
        } else {
            failed += 1;
        }
        if (index + 1) % 10 == 0 {
            progress(count, failed);
        }
    }
    progress(count, failed);
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{atomic::AtomicBool, Mutex};
    fn row(id: &str) -> serde_json::Value {
        json!({"id":id,"title":"Fixture","artist":"Artist","album":"Album","genre":"", "durationMs":60000,"sourceUri":"content://fixture","favorite":false,"available":true,"demo":false,"artworkUrl":null})
    }
    #[test]
    fn manifest_reimport_preserves_favorites_counts_failures_and_cleans_up() {
        let mut store = music_core::Store::open(":memory:").unwrap();
        let mut track: music_core::Track = serde_json::from_value(row("a")).unwrap();
        track.favorite = true;
        store.upsert_track(&track).unwrap();
        store.set_library_visibility(&["a".into()], false).unwrap();
        let core = Mutex::new(store);
        let path = std::env::temp_dir().join(format!("import-{}.jsonl", uuid::Uuid::new_v4()));
        std::fs::write(&path, format!("{}\nmalformed\n{}\n", row("a"), row("b"))).unwrap();
        let mut last = (0, 0);
        assert_eq!(
            import_manifest(&path, &core, &AtomicBool::new(false), 2, |n, f| last =
                (n, f))
            .unwrap(),
            2
        );
        assert_eq!(last, (2, 3));
        assert!(!path.exists());
        assert!(core.lock().unwrap().track("a").unwrap().unwrap().favorite);
        assert!(!core.lock().unwrap().track("a").unwrap().unwrap().hidden);
        assert!(core.lock().unwrap().track("b").unwrap().is_some());
    }
    #[test]
    fn visible_reimport_is_not_counted_as_new() {
        let core = Mutex::new(music_core::Store::open(":memory:").unwrap());
        let path = std::env::temp_dir().join(format!("import-{}.jsonl", uuid::Uuid::new_v4()));
        std::fs::write(&path, format!("{}\n", row("a"))).unwrap();
        assert_eq!(import_manifest(&path, &core, &AtomicBool::new(false), 0, |_, _| {}).unwrap(), 1);
        std::fs::write(&path, format!("{}\n", row("a"))).unwrap();
        assert_eq!(import_manifest(&path, &core, &AtomicBool::new(false), 0, |_, _| {}).unwrap(), 0);
        assert_eq!(core.lock().unwrap().all_tracks().unwrap().len(), 1);
    }
    #[test]
    fn cancelled_manifest_never_adds_unconsumed_rows() {
        let core = Mutex::new(music_core::Store::open(":memory:").unwrap());
        let path = std::env::temp_dir().join(format!("import-{}.jsonl", uuid::Uuid::new_v4()));
        std::fs::write(&path, format!("{}\n", row("a"))).unwrap();
        assert_eq!(
            import_manifest(&path, &core, &AtomicBool::new(true), 0, |_, _| {}).unwrap(),
            0
        );
        assert!(core.lock().unwrap().track("a").unwrap().is_none());
        assert!(!path.exists());
    }
    #[test]
    fn cancellation_between_batches_keeps_only_committed_rows() {
        let core = Mutex::new(music_core::Store::open(":memory:").unwrap());
        let cancel = AtomicBool::new(false);
        let path = std::env::temp_dir().join(format!("import-{}.jsonl", uuid::Uuid::new_v4()));
        std::fs::write(
            &path,
            (0..25)
                .map(|n| format!("{}\n", row(&n.to_string())))
                .collect::<String>(),
        )
        .unwrap();
        let count = import_manifest(&path, &core, &cancel, 0, |n, _| {
            if n == 10 {
                cancel.store(true, Ordering::Relaxed);
            }
        })
        .unwrap();
        assert_eq!(count, 10);
        assert!(core.lock().unwrap().track("9").unwrap().is_some());
        assert!(core.lock().unwrap().track("10").unwrap().is_none());
        assert!(!path.exists());
    }
}

#[tauri::command]
pub(crate) async fn cancel_import(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<()> {
    state.cancel.store(true, Ordering::Relaxed);
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        let _: serde_json::Value = app.native_music().call("cancelImport", json!({}))?;
    }
    let _ = app;
    Ok(())
}
