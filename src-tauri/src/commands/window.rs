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
