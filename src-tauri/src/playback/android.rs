//! Import the Media3 pending journal before acknowledging committed IDs.
use crate::state::Result;
use music_core::{Interval, PlaybackSnapshot, Session, Store};
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub(crate) fn ingest_mobile(
    app: &tauri::AppHandle,
    core: &Arc<Mutex<Store>>,
    value: &serde_json::Value,
) -> Result<()> {
    use tauri_plugin_native_music::NativeMusicExt;
    let mut batch = value.clone();
    loop {
        let mut highest = 0u64;
        {
            let mut store = core.lock().map_err(|e| e.to_string())?;
            if let Some(id) = batch["snapshot"]["unavailableTrackId"].as_str() {
                if let Some(mut track) = store.track(id)? {
                    if track.available {
                        track.available = false;
                        store.upsert_track(&track)?;
                    }
                }
            }
            let cursor = store
                .get_setting::<u64>("android-journal-cursor")?
                .unwrap_or(0);
            if let Some(events) = batch["journal"].as_array() {
                for event in events {
                    let id = event["id"].as_u64().unwrap_or(0);
                    highest = highest.max(id);
                    if id <= cursor {
                        continue;
                    }
                    let s: Session = serde_json::from_value(event["session"].clone())
                        .map_err(|e| e.to_string())?;
                    let interval: Option<Interval> =
                        serde_json::from_value(event["interval"].clone())
                            .map_err(|e| e.to_string())?;
                    store.ingest(&s, interval.as_ref())?;
                    highest = highest.max(event["id"].as_u64().unwrap_or(0));
                }
                store.set_setting("android-journal-cursor", &highest.max(cursor))?;
            }
        }
        if highest > 0 {
            let _: serde_json::Value =
                app.native_music().call("ack", json!({"through":highest}))?;
        }
        if let Some(s) = batch.get("snapshot") {
            let state: PlaybackSnapshot =
                serde_json::from_value(s.clone()).map_err(|e| e.to_string())?;
            let _ = app.emit("playback://snapshot", &state);
        }
        if batch["journal"].as_array().map_or(0, |x| x.len()) < 500 {
            break;
        }
        batch = app.native_music().call("snapshot", json!({}))?;
    }
    Ok(())
}
