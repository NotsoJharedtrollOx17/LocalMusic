use crate::{
    sound::model::Config,
    state::{MusicState, Result},
};
#[cfg(target_os = "android")]
use serde_json::json;
use serde_json::Value;
use tauri::State;
#[tauri::command]
pub(crate) async fn sound_capabilities(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<Value> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(app, "soundCapabilities", json!({})).await
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        serde_json::to_value(state.sound.state()).map_err(|e| e.to_string())
    }
}
#[tauri::command]
pub(crate) async fn set_sound(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    config: Config,
) -> Result<Value> {
    config.validate()?;
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(
            app,
            "setSound",
            json!({"payload":serde_json::to_string(&config).map_err(|e|e.to_string())?}),
        )
        .await
    }
    #[cfg(not(target_os = "android"))]
    {
        crate::playback::dispatch(
            app,
            &state,
            "sound-config",
            serde_json::to_value(config).map_err(|e| e.to_string())?,
        )
        .await?;
        serde_json::to_value(state.sound.state()).map_err(|e| e.to_string())
    }
}
#[tauri::command]
pub(crate) async fn sound_action(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    action: Value,
) -> Result<Value> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(app, "soundAction", json!({"payload":action.to_string()})).await
    }
    #[cfg(not(target_os = "android"))]
    {
        crate::playback::dispatch(app, &state, "sound-action", action).await?;
        serde_json::to_value(state.sound.state()).map_err(|e| e.to_string())
    }
}
#[tauri::command]
pub(crate) async fn personal_action(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    action: Value,
) -> Result<Value> {
    #[cfg(target_os = "android")]
    {
        let _ = state;
        mobile(app, "personalAction", json!({"payload":action.to_string()})).await
    }
    #[cfg(not(target_os = "android"))]
    {
        crate::playback::dispatch(app, &state, "personal-action", action).await?;
        let guard = state.sound.session.lock().map_err(|e| e.to_string())?;
        serde_json::to_value(&guard.as_ref().ok_or("Sound setup is not active")?.view)
            .map_err(|e| e.to_string())
    }
}
#[cfg(target_os = "android")]
async fn mobile(app: tauri::AppHandle, name: &'static str, args: Value) -> Result<Value> {
    use tauri_plugin_native_music::NativeMusicExt;
    tauri::async_runtime::spawn_blocking(move || app.native_music().call(name, args))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn open_sound_panel(app: tauri::AppHandle) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        mobile(app, "openSoundPanel", json!({})).await?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Device sound panel is unavailable on this platform".into())
    }
}
