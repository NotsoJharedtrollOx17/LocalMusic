use crate::state::Result;
use serde_json::json;

#[tauri::command]
pub(crate) async fn sound_capabilities(app: tauri::AppHandle) -> Result<serde_json::Value> {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            app.native_music().call("soundCapabilities", json!({}))
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(json!({"equalizer":false,"systemPanel":false,"enabled":false,"preset":0,"presets":[]}))
    }
}

#[tauri::command]
pub(crate) async fn set_equalizer(app: tauri::AppHandle, enabled: bool, preset: i32) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let _: serde_json::Value = app
                .native_music()
                .call("setEqualizer", json!({"enabled":enabled,"preset":preset}))?;
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, enabled, preset);
        Err("Equalizer is unavailable on this platform".into())
    }
}

#[tauri::command]
pub(crate) async fn open_sound_panel(app: tauri::AppHandle) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let _: serde_json::Value = app.native_music().call("openSoundPanel", json!({}))?;
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Device sound panel is unavailable on this platform".into())
    }
}
