#[cfg(not(target_os = "android"))]
use crate::catalog;
use crate::state::{MusicState, Result};
use music_core::{Playlist, PlaylistRequest, Settings};
use tauri::State;

#[tauri::command]
pub(crate) fn list_playlists(state: State<MusicState>) -> Result<Vec<Playlist>> {
    state.core.lock().map_err(|e| e.to_string())?.playlists()
}

#[tauri::command]
pub(crate) fn save_playlist(state: State<MusicState>, playlist: Playlist) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .save_playlist(&playlist)
}

#[tauri::command]
pub(crate) fn delete_playlist(state: State<MusicState>, id: String) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .delete_playlist(&id)
}

#[tauri::command]
pub(crate) async fn generate_playlist(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    request: PlaylistRequest,
) -> Result<music_core::recommendation::GeneratedMix> {
    crate::playback::dispatch(app.clone(), &state, "flush", serde_json::json!({})).await?;
    #[cfg(target_os = "android")]
    crate::commands::recommendations::refresh_sources(app, &state.core).await?;
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = core.lock().map_err(|e| e.to_string())?;
        #[cfg(not(target_os = "android"))]
        catalog::reconcile(&mut store)?;
        let settings = store
            .get_setting::<Settings>("preferences")?
            .unwrap_or_default();
        music_core::recommendation::generate(
            &request,
            &store.all_tracks()?,
            &store.sessions()?,
            &settings.time_zone,
            chrono::Utc::now(),
            &store.recommendation_data()?,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn automatic_playlists(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<Vec<Playlist>> {
    crate::playback::dispatch(app, &state, "flush", serde_json::json!({})).await?;
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        #[allow(unused_mut)]
        let mut store = core.lock().map_err(|e| e.to_string())?;
        #[cfg(not(target_os = "android"))]
        catalog::reconcile(&mut store)?;
        store.automatic_playlists()
    })
    .await
    .map_err(|e| e.to_string())?
}
