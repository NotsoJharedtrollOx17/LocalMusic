use crate::state::{MusicState, Result};
use serde_json::{json, Value};
use tauri::State;
#[tauri::command]
pub(crate) async fn start_visualizer(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<Value> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(app, "startVisualizer", json!({})).await
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(
            json!({"id":state.sound.visualizer.start(),"capabilities":{"fftSize":2048,"bands":64,"waveformPoints":256,"maxUpdatesPerSecond":30,"postEffects":true}}),
        )
    }
}
#[tauri::command]
pub(crate) async fn read_visualizer(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    id: String,
) -> Result<Value> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        let result = mobile(app, "readVisualizer", json!({"id":id})).await?;
        Ok(result["frame"].clone())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        let tx = state.player.clone();
        let visualizer = state.sound.visualizer.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let (reply, rx) = std::sync::mpsc::channel();
            tx.send(crate::playback::desktop::Request {
                op: "visualizer-clock".into(),
                payload: Value::Null,
                reply,
            })
            .map_err(|e| e.to_string())?;
            rx.recv_timeout(std::time::Duration::from_secs(1))
                .map_err(|e| e.to_string())??;
            serde_json::to_value(visualizer.read(&id)?).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}
#[tauri::command]
pub(crate) async fn stop_visualizer(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    id: String,
) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(app, "stopVisualizer", json!({"id":id})).await?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        state.sound.visualizer.stop(&id);
    }
    Ok(())
}
#[cfg(target_os = "android")]
async fn mobile(app: tauri::AppHandle, name: &'static str, args: Value) -> Result<Value> {
    use tauri_plugin_native_music::NativeMusicExt;
    tauri::async_runtime::spawn_blocking(move || app.native_music().call(name, args))
        .await
        .map_err(|e| e.to_string())?
}
