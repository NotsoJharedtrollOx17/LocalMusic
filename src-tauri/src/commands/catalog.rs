use super::playback::playback_snapshot;
use crate::{
    album_order, artwork,
    playback::dispatch,
    state::{MusicState, Result},
};
use music_core::{LibraryPage, Track};
use serde_json::json;
use tauri::State;

#[tauri::command]
pub(crate) async fn list_tracks(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    query: String,
    offset: usize,
    limit: usize,
    favorite_only: bool,
    sort: String,
) -> Result<LibraryPage> {
    let core = state.core.clone();
    let order_ready = state.order_ready.clone();
    tauri::async_runtime::spawn_blocking(move || {
        album_order::backfill(&core, &order_ready, &app)?;
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
pub(crate) async fn tracks_by_id(
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
pub(crate) async fn group_ids(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    kind: String,
    title: String,
    subtitle: String,
) -> Result<Vec<String>> {
    let core = state.core.clone();
    let order_ready = state.order_ready.clone();
    tauri::async_runtime::spawn_blocking(move || {
        album_order::backfill(&core, &order_ready, &app)?;
        let result = core
            .lock()
            .map_err(|e| e.to_string())?
            .group_ids(&kind, &title, &subtitle);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn list_groups(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    kind: String,
    offset: usize,
) -> Result<music_core::groups::GroupPage> {
    let core = state.core.clone();
    let order_ready = state.order_ready.clone();
    tauri::async_runtime::spawn_blocking(move || {
        album_order::backfill(&core, &order_ready, &app)?;
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
pub(crate) async fn resolve_cover(
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
pub(crate) async fn search_catalog(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    query: String,
    limit: usize,
) -> Result<music_core::search::SearchResults> {
    let core = state.core.clone();
    let ready = state.order_ready.clone();
    tauri::async_runtime::spawn_blocking(move || {
        album_order::backfill(&core, &ready, &app)?;
        let mut result = core
            .lock()
            .map_err(|e| e.to_string())?
            .search_catalog_limit(&query, limit)?;
        let cache = artwork::cache_dir(&app)?;
        for track in &mut result.tracks {
            *track = artwork::decorate(track.clone(), &cache, &app);
        }
        for group in result.albums.iter_mut().chain(result.artists.iter_mut()) {
            group.track = artwork::decorate(group.track.clone(), &cache, &app);
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn set_library_visibility(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
    visible: bool,
) -> Result<()> {
    if !visible {
        let snapshot = playback_snapshot(app.clone(), state.clone()).await?;
        if let Some(current) = snapshot.track_id {
            let queue: Vec<_> = snapshot
                .queue
                .into_iter()
                .filter(|id| !ids.contains(id) || *id == current)
                .collect();
            dispatch(app, &state, "reorder", json!({"ids":queue})).await?;
        }
    }
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .set_library_visibility(&ids, visible)
}

#[tauri::command]
pub(crate) fn set_favorite(state: State<MusicState>, id: String, favorite: bool) -> Result<()> {
    let mut store = state.core.lock().map_err(|e| e.to_string())?;
    let mut track = store.track(&id)?.ok_or("Unknown track")?;
    track.favorite = favorite;
    store.upsert_track(&track)
}
