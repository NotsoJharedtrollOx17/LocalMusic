use crate::state::Result;
#[cfg(not(target_os = "android"))]
use tauri::Manager;

#[tauri::command]
pub(crate) fn show_main_window(app: tauri::AppHandle, dark: bool) -> Result<()> {
    #[cfg(not(target_os = "android"))]
    if let Some(window) = app.get_webview_window("main") {
        let color = if dark {
            tauri::window::Color(20, 22, 21, 255)
        } else {
            tauri::window::Color(250, 248, 244, 255)
        };
        window
            .set_background_color(Some(color))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "android")]
    let _ = (app, dark);
    Ok(())
}

/// Appearance is a main-window UI operation, independent of audio/settings data.
#[tauri::command]
pub(crate) fn set_android_appearance(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    dark: bool,
) -> Result<()> {
    if window.label() != "main" {
        return Err("Appearance belongs to the main window".into());
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        app.native_music()
            .call::<serde_json::Value>("appearance", serde_json::json!({ "dark": dark }))?;
    }
    #[cfg(not(target_os = "android"))]
    let _ = (app, dark);
    Ok(())
}
