//! A fixed informational window; it owns no player or Library controller.
use crate::state::Result;
use serde::Deserialize;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Operation {
    Open,
    Ready,
    Close,
}
fn authorize(caller: &str, op: &Operation) -> Result<()> {
    if matches!(
        (caller, op),
        ("main", Operation::Open) | ("about", Operation::Ready | Operation::Close)
    ) {
        Ok(())
    } else {
        Err("About window operation is not allowed here".into())
    }
}
#[tauri::command]
pub async fn desktop_about(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    op: Operation,
    dark: bool,
) -> Result<()> {
    authorize(window.label(), &op)?;
    #[cfg(windows)]
    {
        use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
        match op {
            Operation::Open => {
                if let Some(existing) = app.get_webview_window("about") {
                    existing.unminimize().ok();
                    existing.set_focus().ok();
                    return Ok(());
                }
                let mut builder = WebviewWindowBuilder::new(
                    &app,
                    "about",
                    WebviewUrl::App("index.html?about=1".into()),
                )
                .title("Local Music - About")
                .visible(false)
                .inner_size(520., 420.)
                .min_inner_size(360., 320.)
                .resizable(true)
                .decorations(true)
                .devtools(false)
                .zoom_hotkeys_enabled(true);
                if let Some(m) = window.current_monitor().map_err(|e| e.to_string())? {
                    let a = m.work_area();
                    let s = m.scale_factor();
                    let width = 520_f64.min(a.size.width as f64 / s - 24.).max(200.);
                    let height = 420_f64.min(a.size.height as f64 / s - 64.).max(200.);
                    builder = builder.inner_size(width, height).position(
                        a.position.x as f64 / s + (a.size.width as f64 / s - width) / 2.,
                        a.position.y as f64 / s + (a.size.height as f64 / s - height) / 2.,
                    );
                }
                let child = builder.build().map_err(|e| e.to_string())?;
                if let Err(error) = crate::webview_policy::configure_window(&child) {
                    child.destroy().ok();
                    return Err(error.to_string());
                }
                let handle = app.clone();
                std::thread::spawn(move || {
                    use tauri::Emitter;
                    std::thread::sleep(std::time::Duration::from_secs(12));
                    // The captured native window ID cannot destroy a newer instance.
                    if child.is_visible().ok() == Some(false) {
                        child.destroy().ok();
                        let _ = handle.emit_to(
                            "main",
                            "desktop://error",
                            "About could not open. Please try again.",
                        );
                    }
                });
            }
            Operation::Ready => {
                let preferences = app
                    .state::<crate::state::MusicState>()
                    .core
                    .lock()
                    .map_err(|e| e.to_string())?
                    .get_setting::<music_core::Settings>("preferences")
                    .map_err(|e| e.to_string())?
                    .unwrap_or_default();
                window
                    .set_title(if preferences.language == "es" {
                        "Local Music - Acerca de Local Music"
                    } else {
                        "Local Music - About Local Music"
                    })
                    .map_err(|e| e.to_string())?;
                window
                    .set_theme(if preferences.theme == "system" {
                        None
                    } else {
                        Some(if dark {
                            tauri::Theme::Dark
                        } else {
                            tauri::Theme::Light
                        })
                    })
                    .map_err(|e| e.to_string())?;
                window
                    .set_background_color(Some(if dark {
                        tauri::window::Color(20, 22, 21, 255)
                    } else {
                        tauri::window::Color(250, 248, 244, 255)
                    }))
                    .map_err(|e| e.to_string())?;
                window.show().map_err(|e| e.to_string())?;
            }
            Operation::Close => window.close().map_err(|e| e.to_string())?,
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, window, dark);
        Err("Separate About windows are available on Windows".into())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn about_has_fixed_callers_and_no_media_ownership() {
        assert!(authorize("main", &Operation::Open).is_ok());
        assert!(authorize("about", &Operation::Ready).is_ok());
        assert!(authorize("about", &Operation::Close).is_ok());
        assert!(authorize("about", &Operation::Open).is_err());
        assert!(authorize("main", &Operation::Close).is_err());
        assert!(authorize("player", &Operation::Ready).is_err());
    }
}
