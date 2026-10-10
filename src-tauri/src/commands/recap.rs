use crate::{
    artwork,
    playback::dispatch,
    state::{MusicState, Result},
};
use music_core::{Recap, Settings};
use serde_json::json;
use tauri::State;

#[tauri::command]
pub(crate) async fn get_recap(
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
pub(crate) fn save_snapshot(state: State<MusicState>, recap: Recap) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .save_snapshot(&recap)
}

#[tauri::command]
pub(crate) fn list_snapshots(state: State<MusicState>) -> Result<Vec<Recap>> {
    state.core.lock().map_err(|e| e.to_string())?.snapshots()
}

#[tauri::command]
pub(crate) async fn delete_history(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<()> {
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
