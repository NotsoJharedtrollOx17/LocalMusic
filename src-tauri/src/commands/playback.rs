#[cfg(target_os = "android")]
use crate::playback::ingest_mobile;
use crate::{
    playback::dispatch,
    state::{MusicState, Result},
};
use music_core::PlaybackSnapshot;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub(crate) async fn playback_snapshot(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<serde_json::Value> {
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let snapshot = state.snapshot.lock().map_err(|e| e.to_string())?;
        let mut value = serde_json::to_value(&*snapshot).map_err(|e| e.to_string())?;
        value["revision"] = crate::playback::desktop::SNAPSHOT_REVISION
            .load(std::sync::atomic::Ordering::SeqCst)
            .into();
        Ok(value)
    }
    #[cfg(target_os = "android")]
    {
        serde_json::to_value(current_playback(app, state).await?).map_err(|e| e.to_string())
    }
}
pub(crate) async fn current_playback(
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
pub(crate) async fn play_queue(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
    index: Option<usize>,
) -> Result<()> {
    let selected = match index {
        Some(index) => Some(ids.get(index).ok_or("Select an available track")?.clone()),
        None => None,
    };
    let ids: Vec<String> = {
        let store = state.core.lock().map_err(|e| e.to_string())?;
        ids.iter()
            .filter_map(|id| match store.track(id) {
                Ok(Some(t)) if !t.hidden => Some(Ok(id.clone())),
                Ok(_) => None,
                Err(e) => Some(Err(e)),
            })
            .collect::<Result<_>>()?
    };
    if ids.is_empty() {
        return Err("Select an available track".into());
    }
    let index = match selected {
        Some(selected) => ids
            .iter()
            .position(|id| id == &selected)
            .ok_or("Track was removed from Library")?,
        None => 0,
    };
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
pub(crate) async fn toggle_playback(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<()> {
    dispatch(app, &state, "toggle", json!({})).await
}

#[tauri::command]
pub(crate) async fn seek(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ms: u64,
) -> Result<()> {
    dispatch(app, &state, "seek", json!({"ms":ms})).await
}

#[tauri::command]
pub(crate) async fn next_track(app: tauri::AppHandle, state: State<'_, MusicState>) -> Result<()> {
    dispatch(app, &state, "next", json!({})).await
}

#[tauri::command]
pub(crate) async fn previous_track(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<()> {
    dispatch(app, &state, "previous", json!({})).await
}

#[tauri::command]
pub(crate) async fn set_shuffle(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: bool,
) -> Result<()> {
    dispatch(app, &state, "shuffle", json!({"value":value})).await
}

#[tauri::command]
pub(crate) async fn set_repeat(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: String,
) -> Result<()> {
    dispatch(app, &state, "repeat", json!({"value":value})).await
}

#[tauri::command]
pub(crate) async fn set_excluded(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    value: bool,
) -> Result<()> {
    dispatch(app, &state, "excluded", json!({"value":value})).await
}

#[tauri::command]
pub(crate) async fn reorder_queue(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
) -> Result<()> {
    dispatch(app, &state, "reorder", json!({"ids":ids})).await
}
