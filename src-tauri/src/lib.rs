use music_core::*;
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{Emitter, Manager, State};
mod artwork;
#[cfg(not(target_os = "android"))]
mod catalog;
#[cfg(not(target_os = "android"))]
mod desktop;
struct MusicState {
    core: Arc<Mutex<Store>>,
    snapshot: Arc<Mutex<PlaybackSnapshot>>,
    cancel: Arc<AtomicBool>,
    #[cfg(not(target_os = "android"))]
    player: std::sync::mpsc::Sender<desktop::Request>,
}
type Result<T> = std::result::Result<T, String>;
async fn command(
    app: tauri::AppHandle,
    core: Arc<Mutex<Store>>,
    op: &str,
    payload: serde_json::Value,
    #[cfg(not(target_os = "android"))] tx: std::sync::mpsc::Sender<desktop::Request>,
) -> Result<()> {
    #[cfg(not(target_os = "android"))]
    {
        let op = op.to_string();
        let _ = (app, core);
        tauri::async_runtime::spawn_blocking(move || {
            let (reply, rx) = std::sync::mpsc::channel();
            tx.send(desktop::Request { op, payload, reply })
                .map_err(|e| e.to_string())?;
            rx.recv_timeout(std::time::Duration::from_secs(10))
                .map_err(|e| e.to_string())?
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "android")]
    {
        let _ = app.emit("catalog://progress", json!({"imported":0,"failed":0}));
        use tauri_plugin_native_music::NativeMusicExt;
        let op = op.to_string();
        tauri::async_runtime::spawn_blocking(move || {
            let value: serde_json::Value = app
                .native_music()
                .call("control", json!({"op":op,"payload":payload.to_string()}))?;
            ingest_mobile(&app, &core, &value)?;
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}
#[cfg(target_os = "android")]
fn ingest_mobile(
    app: &tauri::AppHandle,
    core: &Arc<Mutex<Store>>,
    value: &serde_json::Value,
) -> Result<()> {
    use tauri_plugin_native_music::NativeMusicExt;
    let mut batch = value.clone();
    loop {
        let mut highest = 0u64;
        {
            let mut store = core.lock().map_err(|e| e.to_string())?;
            if let Some(id) = batch["snapshot"]["unavailableTrackId"].as_str() {
                if let Some(mut track) = store.track(id)? {
                    if track.available {
                        track.available = false;
                        store.upsert_track(&track)?;
                    }
                }
            }
            let cursor = store
                .get_setting::<u64>("android-journal-cursor")?
                .unwrap_or(0);
            if let Some(events) = batch["journal"].as_array() {
                for event in events {
                    let id = event["id"].as_u64().unwrap_or(0);
                    highest = highest.max(id);
                    if id <= cursor {
                        continue;
                    }
                    let s: Session = serde_json::from_value(event["session"].clone())
                        .map_err(|e| e.to_string())?;
                    let interval: Option<Interval> =
                        serde_json::from_value(event["interval"].clone())
                            .map_err(|e| e.to_string())?;
                    store.ingest(&s, interval.as_ref())?;
                    highest = highest.max(event["id"].as_u64().unwrap_or(0));
                }
                store.set_setting("android-journal-cursor", &highest.max(cursor))?;
            }
        }
        if highest > 0 {
            let _: serde_json::Value =
                app.native_music().call("ack", json!({"through":highest}))?;
        }
        if let Some(s) = batch.get("snapshot") {
            let state: PlaybackSnapshot =
                serde_json::from_value(s.clone()).map_err(|e| e.to_string())?;
            let _ = app.emit("playback://snapshot", &state);
        }
        if batch["journal"].as_array().map_or(0, |x| x.len()) < 500 {
            break;
        }
        batch = app.native_music().call("snapshot", json!({}))?;
    }
    Ok(())
}
async fn dispatch(
    app: tauri::AppHandle,
    state: &MusicState,
    op: &str,
    payload: serde_json::Value,
) -> Result<()> {
    command(
        app,
        state.core.clone(),
        op,
        payload,
        #[cfg(not(target_os = "android"))]
        state.player.clone(),
    )
    .await
}
#[tauri::command]
async fn list_tracks(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    query: String,
    offset: usize,
    limit: usize,
    favorite_only: bool,
    sort: String,
) -> Result<LibraryPage> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut page = core
            .lock()
            .map_err(|e| e.to_string())?
            .tracks_with_options(&query, offset, limit, favorite_only, &sort)?;
        let cache = artwork::cache_dir(&app)?;
        page.tracks = page
            .tracks
            .into_iter()
            .map(|t| artwork::decorate(t, &cache, &app))
            .collect();
        Ok(page)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn tracks_by_id(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
) -> Result<Vec<Track>> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let tracks: Vec<Track> = {
            let store = core.lock().map_err(|e| e.to_string())?;
            ids.iter()
                .filter_map(|id| store.track(id).transpose())
                .collect::<Result<_>>()?
        };
        let cache = artwork::cache_dir(&app)?;
        Ok(tracks
            .into_iter()
            .map(|t| artwork::decorate(t, &cache, &app))
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn group_ids(
    state: State<MusicState>,
    kind: String,
    title: String,
    subtitle: String,
) -> Result<Vec<String>> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .group_ids(&kind, &title, &subtitle)
}
#[tauri::command]
async fn list_groups(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    kind: String,
    offset: usize,
) -> Result<music_core::groups::GroupPage> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut page = core
            .lock()
            .map_err(|e| e.to_string())?
            .groups(&kind, offset, 60)?;
        let cache = artwork::cache_dir(&app)?;
        for g in &mut page.groups {
            g.track = artwork::decorate(g.track.clone(), &cache, &app);
        }
        Ok(page)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn resolve_cover(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    id: String,
    size: u32,
) -> Result<String> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let track = core
            .lock()
            .map_err(|e| e.to_string())?
            .track(&id)?
            .ok_or("Unknown track")?;
        artwork::resolve(&track, size, &artwork::cache_dir(&app)?, &app)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_music(
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
                    store.upsert_track(&track)
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
async fn cancel_import(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    state.cancel.store(true, Ordering::Relaxed);
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        let _: serde_json::Value = app.native_music().call("cancelImport", json!({}))?;
    }
    let _ = app;
    Ok(())
}
#[tauri::command]
fn set_favorite(state: State<MusicState>, id: String, favorite: bool) -> Result<()> {
    let mut store = state.core.lock().map_err(|e| e.to_string())?;
    let mut track = store.track(&id)?.ok_or("Unknown track")?;
    track.favorite = favorite;
    store.upsert_track(&track)
}
#[tauri::command]
fn list_playlists(state: State<MusicState>) -> Result<Vec<Playlist>> {
    state.core.lock().map_err(|e| e.to_string())?.playlists()
}
#[tauri::command]
fn save_playlist(state: State<MusicState>, playlist: Playlist) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .save_playlist(&playlist)
}
#[tauri::command]
fn delete_playlist(state: State<MusicState>, id: String) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .delete_playlist(&id)
}
#[tauri::command]
async fn generate_playlist(
    state: State<'_, MusicState>,
    request: PlaylistRequest,
) -> Result<Playlist> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = core.lock().map_err(|e| e.to_string())?;
        #[cfg(not(target_os = "android"))]
        catalog::reconcile(&mut store)?;
        let settings = store
            .get_setting::<Settings>("preferences")?
            .unwrap_or_default();
        music_core::playlist::generate(
            &request,
            &store.all_tracks()?,
            &store.sessions()?,
            &settings.time_zone,
            chrono::Utc::now(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_settings(state: State<MusicState>, default_time_zone: String) -> Result<Settings> {
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut settings = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    if !store
        .get_setting::<bool>("time-zone-initialized")?
        .unwrap_or(false)
    {
        if default_time_zone.parse::<chrono_tz::Tz>().is_ok() {
            settings.time_zone = default_time_zone;
        }
        store.set_setting("preferences", &settings)?;
        store.set_setting("time-zone-initialized", &true)?;
    }
    Ok(settings)
}
#[tauri::command]
fn save_settings(state: State<MusicState>, settings: Settings) -> Result<()> {
    settings
        .time_zone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| "Invalid time zone")?;
    if !["en", "es"].contains(&settings.language.as_str())
        || !["light", "dark", "system"].contains(&settings.theme.as_str())
    {
        return Err("Invalid settings".into());
    }
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut next = settings;
    let current = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    next.history_enabled_since = current.history_enabled_since;
    next.privacy_revision = current.privacy_revision;
    store.set_setting("preferences", &next)
}
#[tauri::command]
async fn get_recap(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    year: i32,
) -> Result<Recap> {
    if !(1970..=9998).contains(&year) {
        return Err("Invalid recap year".into());
    }
    dispatch(app.clone(), &state, "flush", json!({})).await?;
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut recap = music_core::recap::aggregate(
        year,
        &store
            .get_setting::<Settings>("preferences")?
            .unwrap_or_default(),
        &store.all_tracks()?,
        &store.sessions()?,
        &store.intervals()?,
        chrono::Utc::now(),
    )?;
    drop(store);
    let cache = artwork::cache_dir(&app)?;
    for ranked in &mut recap.top_tracks {
        ranked.track = artwork::decorate(ranked.track.clone(), &cache, &app);
    }
    Ok(recap)
}
#[tauri::command]
fn save_snapshot(state: State<MusicState>, recap: Recap) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .save_snapshot(&recap)
}
#[tauri::command]
fn list_snapshots(state: State<MusicState>) -> Result<Vec<Recap>> {
    state.core.lock().map_err(|e| e.to_string())?.snapshots()
}
#[tauri::command]
async fn delete_history(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    dispatch(app.clone(), &state, "deleteHistory", json!({})).await?;
    #[cfg(target_os = "android")]
    {
        state
            .core
            .lock()
            .map_err(|e| e.to_string())?
            .delete_history()?;
    }
    Ok(())
}
#[tauri::command]
async fn playback_snapshot(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<PlaybackSnapshot> {
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(state.snapshot.lock().map_err(|e| e.to_string())?.clone())
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        let app2 = app.clone();
        let value: serde_json::Value = tauri::async_runtime::spawn_blocking(move || {
            app2.native_music().call("snapshot", json!({}))
        })
        .await
        .map_err(|e| e.to_string())??;
        ingest_mobile(&app, &state.core, &value)?;
        serde_json::from_value(value["snapshot"].clone()).map_err(|e| e.to_string())
    }
}
#[tauri::command]
async fn play_queue(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
    index: usize,
) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        let tracks = {
            let store = state.core.lock().map_err(|e| e.to_string())?;
            ids.iter()
                .map(|id| store.track(id)?.ok_or("Unknown track".into()))
                .collect::<Result<Vec<_>>>()?
        };
        return dispatch(
            app,
            &state,
            "play",
            json!({"ids":ids,"index":index,"tracks":tracks}),
        )
        .await;
    }
    #[cfg(not(target_os = "android"))]
    dispatch(app, &state, "play", json!({"ids":ids,"index":index})).await
}
#[tauri::command]
async fn toggle_playback(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    dispatch(app, &state, "toggle", json!({})).await
}
#[tauri::command]
async fn seek(app: tauri::AppHandle, state: State<'_, MusicState>, ms: u64) -> Result<()> {
    dispatch(app, &state, "seek", json!({"ms":ms})).await
}
#[tauri::command]
async fn next_track(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    dispatch(app, &state, "next", json!({})).await
}
#[tauri::command]
async fn previous_track(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    dispatch(app, &state, "previous", json!({})).await
}
#[tauri::command]
async fn set_shuffle(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: bool,
) -> Result<()> {
    dispatch(app, &state, "shuffle", json!({"value":value})).await
}
#[tauri::command]
async fn set_repeat(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: String,
) -> Result<()> {
    dispatch(app, &state, "repeat", json!({"value":value})).await
}
#[tauri::command]
async fn set_excluded(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: bool,
) -> Result<()> {
    dispatch(app, &state, "excluded", json!({"value":value})).await
}
#[tauri::command]
async fn reorder_queue(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
) -> Result<()> {
    dispatch(app, &state, "reorder", json!({"ids":ids})).await
}
#[tauri::command]
async fn export_file(app: tauri::AppHandle, name: String, bytes: Vec<u8>) -> Result<()> {
    if name.contains(['/', '\\']) || bytes.len() > 20 * 1024 * 1024 {
        return Err("Invalid export".into());
    }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::DialogExt;
        tauri::async_runtime::spawn_blocking(move || {
            if let Some(file) = app
                .dialog()
                .file()
                .set_file_name(&name)
                .blocking_save_file()
            {
                let p = file.into_path().map_err(|e| e.to_string())?;
                std::fs::write(p, bytes).map_err(|e| e.to_string())?;
            }
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let _: serde_json::Value = app
                .native_music()
                .call("exportFile", json!({"name":name,"bytes":bytes}))?;
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_dialog::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_native_music::init());
    builder
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let core = Arc::new(Mutex::new(
                Store::open(dir.join("music.sqlite")).map_err(std::io::Error::other)?,
            ));
            let snapshot = Arc::new(Mutex::new(PlaybackSnapshot {
                repeat: "off".into(),
                ..Default::default()
            }));
            #[cfg(not(target_os = "android"))]
            let player = desktop::launch(app.handle().clone(), core.clone(), snapshot.clone());
            app.manage(MusicState {
                core,
                snapshot,
                cancel: Arc::new(AtomicBool::new(false)),
                #[cfg(not(target_os = "android"))]
                player,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tracks,
            list_groups,
            group_ids,
            tracks_by_id,
            resolve_cover,
            import_music,
            cancel_import,
            set_favorite,
            list_playlists,
            save_playlist,
            delete_playlist,
            generate_playlist,
            get_settings,
            save_settings,
            get_recap,
            save_snapshot,
            list_snapshots,
            delete_history,
            playback_snapshot,
            play_queue,
            toggle_playback,
            seek,
            next_track,
            previous_track,
            set_shuffle,
            set_repeat,
            set_excluded,
            reorder_queue,
            export_file
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Local Music");
}
