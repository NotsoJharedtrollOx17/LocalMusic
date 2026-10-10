//! Platform dispatch; each native player remains the playback clock authority.
use crate::state::{MusicState, Result};
use music_core::Store;
#[cfg(target_os = "android")]
use serde_json::json;
use std::sync::{Arc, Mutex};
#[cfg(target_os = "android")]
use tauri::Emitter;

#[cfg(target_os = "android")]
mod android;
#[cfg(target_os = "android")]
pub(crate) use android::ingest_mobile;
#[cfg(not(target_os = "android"))]
pub(crate) mod desktop;

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

pub(crate) async fn dispatch(
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
