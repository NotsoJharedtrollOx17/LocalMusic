use crate::state::{MusicState, Result};
use music_core::Settings;
use tauri::State;

#[tauri::command]
pub(crate) fn get_settings(
    state: State<MusicState>,
    default_time_zone: String,
) -> Result<Settings> {
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut settings = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    if !store
        .get_setting::<bool>("time-zone-initialized")?
        .unwrap_or(false)
    {
        if default_time_zone.parse::<chrono_tz::Tz>().is_ok() {
            settings.time_zone = default_time_zone;
        }
        store.set_setting("preferences", &settings)?;
        store.set_setting("time-zone-initialized", &true)?;
    }
    Ok(settings)
}

#[tauri::command]
pub(crate) fn save_settings(state: State<MusicState>, settings: Settings) -> Result<()> {
    settings
        .time_zone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| "Invalid time zone")?;
    if !["en", "es"].contains(&settings.language.as_str())
        || !["light", "dark", "system"].contains(&settings.theme.as_str())
    {
        return Err("Invalid settings".into());
    }
    let store = state.core.lock().map_err(|e| e.to_string())?;
    let mut next = settings;
    let current = store
        .get_setting::<Settings>("preferences")?
        .unwrap_or_default();
    next.history_enabled_since = current.history_enabled_since;
    next.privacy_revision = current.privacy_revision;
    store.set_setting("preferences", &next)
}
