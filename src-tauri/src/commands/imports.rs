use crate::state::{MusicState, Result};
#[cfg(not(target_os = "android"))]
use crate::{artwork, catalog};
#[cfg(target_os = "android")]
use music_core::Track;
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
                    if let Some(old) = store.track(&track.id)? {
                        track.favorite = old.favorite;
                    }
                    store.upsert_track(&track)?;
                    store.set_library_visibility(&[track.id.clone()], true)
                });
                if result.is_ok() {
                    n += 1;
                } else {
                    failures += 1;
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
        let app2 = app.clone();
        let value: serde_json::Value = tauri::async_runtime::spawn_blocking(move || {
            app2.native_music()
                .call("importMusic", json!({"mode":mode}))
        })
        .await
        .map_err(|e| e.to_string())??;
        if value["manifestPath"].is_null() {
            return Ok(0);
        };
        let manifest = value["manifestPath"]
            .as_str()
            .ok_or("Invalid import response")?;
        let _ = app.emit("catalog://progress", json!({"imported":0,"failed":0}));
        let file = std::fs::File::open(manifest).map_err(|e| e.to_string())?;
        let mut count = 0;
        use std::io::BufRead;
        for line in std::io::BufReader::new(file).lines() {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            let mut t: Track = serde_json::from_str(&line.map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            let mut store = core.lock().map_err(|e| e.to_string())?;
            if let Some(old) = store.track(&t.id)? {
                t.favorite = old.favorite;
            }
            store.upsert_track(&t)?;
            store.set_library_visibility(&[t.id.clone()], true)?;
            count += 1;
            drop(store);
            if count % 10 == 0 {
                let _ = app.emit("catalog://progress", json!({"imported":count,"failed":0}));
            }
        }
        let _ = app.emit("catalog://progress", json!({"imported":count,"failed":0}));
        let _ = std::fs::remove_file(manifest);
        Ok(count)
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
