use crate::state::{MusicState, Result};
use music_core::{Settings, Store};
use tauri::State;

#[tauri::command]
pub(crate) fn get_settings(
    state: State<MusicState>,
    default_time_zone: String,
) -> Result<Settings> {
    let store = state.core.lock().map_err(|e| e.to_string())?;
    device_settings(&store, default_time_zone)
}

fn device_settings(store: &Store, default_time_zone: String) -> Result<Settings> {
    let stored = store.get_setting::<Settings>("preferences")?;
    let mut settings = stored.clone().unwrap_or_default();
    // Live recaps follow the device; frozen snapshots retain their own zone.
    if default_time_zone.parse::<chrono_tz::Tz>().is_ok() && settings.time_zone != default_time_zone
    {
        settings.time_zone = default_time_zone;
    }
    if stored.as_ref().map(|s| s.time_zone.as_str()) != Some(settings.time_zone.as_str()) {
        store.set_setting("preferences", &settings)?;
    }
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_zone_replaces_old_override_without_changing_history_preferences() {
        let store = Store::open(":memory:").unwrap();
        let original = Settings {
            time_zone: "America/Los_Angeles".into(),
            language: "es".into(),
            theme: "dark".into(),
            ..Default::default()
        };
        store.set_setting("preferences", &original).unwrap();
        store.set_setting("time-zone-initialized", &true).unwrap();
        let updated = device_settings(&store, "America/New_York".into()).unwrap();
        assert_eq!(updated.time_zone, "America/New_York");
        assert_eq!(updated.language, original.language);
        assert_eq!(updated.theme, original.theme);
        assert_eq!(
            updated.history_enabled_since,
            original.history_enabled_since
        );
        assert_eq!(updated.privacy_revision, original.privacy_revision);
        assert_eq!(
            device_settings(&store, "invalid-zone".into())
                .unwrap()
                .time_zone,
            updated.time_zone
        );
        assert_eq!(
            store
                .get_setting::<Settings>("preferences")
                .unwrap()
                .unwrap()
                .time_zone,
            updated.time_zone
        );
    }
}

#[tauri::command]
pub(crate) fn save_settings(state: State<MusicState>, settings: Settings) -> Result<()> {
    validate(&settings)?;
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut next = settings;
    let current = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    next.history_enabled_since = current.history_enabled_since;
    next.privacy_revision = current.privacy_revision;
    store.set_setting("preferences", &next)
}

fn validate(settings: &Settings) -> Result<()> {
    settings
        .time_zone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| "Invalid time zone")?;
    if !["en", "es"].contains(&settings.language.as_str())
        || settings
            .playlist_blend
            .as_ref()
            .is_some_and(|s| !["familiar", "balanced", "explore"].contains(&s.as_str()))
        || !["light", "dark", "system"].contains(&settings.theme.as_str())
        || settings
            .visualizer_mode
            .as_ref()
            .is_some_and(|m| !["spectrum", "geometry", "xmb"].contains(&m.as_str()))
    {
        return Err("Invalid settings".into());
    }
    Ok(())
}

/// Merge only editable fields while holding the store lock. Other windows and
/// history/privacy-owned preferences cannot be overwritten by a stale UI record.
fn apply_patch(store: &Store, patch: serde_json::Value) -> Result<Settings> {
    let object = patch.as_object().ok_or("Expected preference fields")?;
    let allowed = [
        "language",
        "theme",
        "timeZone",
        "visualizerMode",
        "playlistBlend",
        "recapPeriod",
    ];
    if object.keys().any(|k| !allowed.contains(&k.as_str())) {
        return Err("Unsupported preference field".into());
    }
    let current = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    let mut value = serde_json::to_value(current).map_err(|e| e.to_string())?;
    for (key, field) in object {
        value[key] = field.clone();
    }
    let next: Settings = serde_json::from_value(value).map_err(|e| e.to_string())?;
    validate(&next)?;
    store.set_setting("preferences", &next)?;
    Ok(next)
}
#[tauri::command]
pub(crate) fn patch_settings(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<MusicState>,
    patch: serde_json::Value,
) -> Result<Settings> {
    if !["main", "player", "visualizer"].contains(&window.label()) {
        return Err("Unknown window".into());
    }
    let next = {
        let store = state.core.lock().map_err(|e| e.to_string())?;
        apply_patch(&store, patch)?
    };
    crate::desktop_windows::desktop_changed(app, window, "settings".into(), None)?;
    Ok(next)
}
#[cfg(test)]
mod patch_tests {
    use super::*;
    #[test]
    fn stale_windows_merge_fields_without_losing_privacy() {
        let store = Store::open(":memory:").unwrap();
        let initial = Settings {
            privacy_revision: 7,
            ..Default::default()
        };
        store.set_setting("preferences", &initial).unwrap();
        apply_patch(&store, serde_json::json!({"language":"es"})).unwrap();
        let next = apply_patch(&store, serde_json::json!({"visualizerMode":"xmb"})).unwrap();
        assert_eq!(next.language, "es");
        assert_eq!(next.visualizer_mode.as_deref(), Some("xmb"));
        assert_eq!(next.privacy_revision, 7);
        assert!(apply_patch(&store, serde_json::json!({"privacyRevision":0})).is_err());
        assert!(apply_patch(&store, serde_json::json!({"theme":"neon"})).is_err());
    }
}
