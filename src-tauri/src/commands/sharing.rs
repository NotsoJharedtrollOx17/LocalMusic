#[cfg(target_os = "android")]
use base64::Engine;
use crate::state::{MusicState, Result};
#[cfg(target_os = "android")]
use serde_json::json;
#[cfg(not(target_os = "android"))]
use tauri::Manager;
use tauri::State;

#[tauri::command]
pub(crate) async fn share_audio(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    ids: Vec<String>,
) -> Result<String> {
    let tracks = {
        let store = state.core.lock().map_err(|e| e.to_string())?;
        ids.iter()
            .map(|id| {
                store
                    .track(id)?
                    .filter(|t| t.available)
                    .ok_or("Audio source unavailable".into())
            })
            .collect::<Result<Vec<_>>>()?
    };
    if tracks.is_empty() {
        return Err("Select audio to share".into());
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let value: serde_json::Value = app.native_music().call(
                "shareAudio",
                json!({"uris":tracks.iter().map(|t| &t.source_uri).collect::<Vec<_>>()}),
            )?;
            Ok(value["outcome"].as_str().unwrap_or("opened").to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::DialogExt;
        tauri::async_runtime::spawn_blocking(move || {
            let mut dialog = app.dialog().file().set_title("Save audio copies");
            if let Some(window) = app.get_webview_window("main") {
                dialog = dialog.set_parent(&window);
            }
            let destination = if tracks.len() == 1 {
                let name = std::path::Path::new(&tracks[0].source_uri)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("audio");
                dialog.set_file_name(name).blocking_save_file()
            } else {
                dialog.blocking_pick_folder()
            };
            let Some(destination) = destination else {
                return Ok("canceled".into());
            };
            let destination = destination.into_path().map_err(|e| e.to_string())?;
            for (index, track) in tracks.iter().enumerate() {
                let source = std::path::Path::new(&track.source_uri);
                let target = if tracks.len() == 1 {
                    destination.clone()
                } else {
                    let name = source
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("audio");
                    let mut target = destination.join(name);
                    if target.exists() {
                        target = destination.join(format!("{}-{}", index + 1, name));
                    }
                    if target.exists() {
                        return Err("Destination already exists; select another folder".into());
                    }
                    target
                };
                if source.canonicalize().ok() == target.canonicalize().ok() && target.exists() {
                    return Err("Select a destination different from the original file".into());
                }
                std::fs::copy(source, target).map_err(|e| e.to_string())?;
            }
            Ok("saved".into())
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

#[tauri::command]
pub(crate) async fn export_file(
    app: tauri::AppHandle,
    name: String,
    bytes: Vec<u8>,
) -> Result<bool> {
    validate_image(&name, &bytes)?;
    #[cfg(not(target_os = "android"))]
    {
        use tauri_plugin_dialog::DialogExt;
        tauri::async_runtime::spawn_blocking(move || {
            let mut dialog = app
                .dialog()
                .file()
                .add_filter("PNG image", &["png"])
                .set_file_name(&name);
            if let Some(window) = app.get_webview_window("main") {
                dialog = dialog.set_parent(&window);
            }
            if let Some(file) = dialog.blocking_save_file() {
                let p = file.into_path().map_err(|e| e.to_string())?;
                std::fs::write(p, bytes).map_err(|e| e.to_string())?;
                return Ok(true);
            }
            Ok(false)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let value: serde_json::Value = app
                .native_music()
                .call("exportFile", json!({"name":name,"base64":base64::engine::general_purpose::STANDARD.encode(&bytes)}))?;
            Ok(value["saved"].as_bool().unwrap_or(false))
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

fn validate_image(name: &str, bytes: &[u8]) -> Result<()> {
    if name.is_empty()
        || name.len() > 240
        || name.contains(['/', '\\', '\0'])
        || !name.ends_with(".png")
        || bytes.len() > 20 * 1024 * 1024
        || !bytes.starts_with(b"\x89PNG\r\n\x1a\n")
    {
        return Err("Invalid PNG export".into());
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn image_export_capabilities(app: tauri::AppHandle) -> Result<serde_json::Value> {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        return tauri::async_runtime::spawn_blocking(move || {
            app.native_music()
                .call("imageExportCapabilities", serde_json::json!({}))
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(serde_json::json!({"save":"picker","share":false}))
    }
}
#[tauri::command]
pub(crate) async fn share_recap_image(
    app: tauri::AppHandle,
    name: String,
    bytes: Vec<u8>,
) -> Result<String> {
    validate_image(&name, &bytes)?;
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            let value: serde_json::Value = app.native_music().call(
                "shareRecapImage",
                serde_json::json!({"name":name,"base64":base64::engine::general_purpose::STANDARD.encode(&bytes)}),
            )?;
            Ok(value["outcome"]
                .as_str()
                .unwrap_or("unavailable")
                .to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok("unavailable".into())
    }
}
#[cfg(test)]
mod image_tests {
    use super::*;
    #[test]
    fn image_boundary_rejects_paths_and_non_png() {
        assert!(validate_image("../secret.png", b"\x89PNG\r\n\x1a\n").is_err());
        assert!(validate_image("recap.png", b"wrong bytes").is_err());
        assert!(validate_image("recap.png", b"\x89PNG\r\n\x1a\n").is_ok());
    }
}
