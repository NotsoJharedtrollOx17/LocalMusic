use crate::state::{MusicState, Result};
use music_core::{identity::*, Playlist};
use serde::{Deserialize, Serialize};
use tauri::State;
#[derive(Clone, Serialize, Deserialize)]
pub struct CleanupPreview {
    playlist: Playlist,
    cleaned: Playlist,
    revision: u64,
}
#[tauri::command]
pub(crate) async fn library_organization(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<OrganizationSnapshot> {
    let core = state.core.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (state, tracks) = {
            let store = core.lock().map_err(|e| e.to_string())?;
            (
                store.organization()?,
                store
                    .all_tracks()?
                    .into_iter()
                    .filter(|t| !t.hidden)
                    .collect::<Vec<_>>(),
            )
        };
        let (song_candidates, album_candidates) = candidates(&tracks, &state);
        let mut snapshot = OrganizationSnapshot {
            state,
            tracks,
            song_candidates,
            album_candidates,
        };
        let cache = crate::artwork::cache_dir(&app)?;
        snapshot.tracks = snapshot
            .tracks
            .into_iter()
            .map(|t| crate::artwork::decorate(t, &cache, &app))
            .collect();
        Ok(snapshot)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) fn organize_library(
    state: State<MusicState>,
    revision: u64,
    action: serde_json::Value,
) -> Result<Organization> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .organize_library(revision, action)
}
#[tauri::command]
pub(crate) fn playlist_cleanup(state: State<MusicState>, id: String) -> Result<CleanupPreview> {
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let playlist = store
        .playlists()?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or("Unknown saved playlist")?;
    let tracks = store.all_tracks()?;
    let mut seen = std::collections::BTreeSet::new();
    let mut cleaned = playlist.clone();
    cleaned.track_ids.retain(|id| {
        seen.insert(
            tracks
                .iter()
                .find(|t| &t.id == id)
                .map(|t| song_key(t).to_owned())
                .unwrap_or_else(|| id.clone()),
        )
    });
    Ok(CleanupPreview {
        playlist,
        cleaned,
        revision: store.organization()?.revision,
    })
}
#[tauri::command]
pub(crate) fn apply_playlist_cleanup(
    state: State<MusicState>,
    preview: CleanupPreview,
    undo: bool,
) -> Result<()> {
    let store = state.core.lock().map_err(|e| e.to_string())?;
    if store.organization()?.revision != preview.revision {
        return Err("Library organization changed. Refresh and retry.".into());
    }
    let current = store
        .playlists()?
        .into_iter()
        .find(|p| p.id == preview.playlist.id)
        .ok_or("Unknown playlist")?;
    let expected = if undo {
        &preview.cleaned
    } else {
        &preview.playlist
    };
    if serde_json::to_value(&current).unwrap() != serde_json::to_value(expected).unwrap() {
        return Err("Playlist changed. Refresh and retry.".into());
    }
    let target = if undo {
        &preview.playlist
    } else {
        &preview.cleaned
    };
    if target.id != current.id || target.title != current.title || target.kind != current.kind {
        return Err("Invalid cleanup".into());
    }
    if !undo {
        let mut seen = std::collections::BTreeSet::new();
        let mut ids = vec![];
        for id in &current.track_ids {
            let t = store.track(id)?.ok_or("Unknown track")?;
            if seen.insert(song_key(&t).to_owned()) {
                ids.push(id.clone());
            }
        }
        if ids != target.track_ids {
            return Err("Invalid cleanup preview".into());
        }
    }
    store.save_playlist_unchecked(target)
}
