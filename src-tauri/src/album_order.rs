use music_core::{Store, Track};
use std::sync::{Arc, Mutex};

// Serialize the first legacy metadata pass separately from the catalog mutex.
// File/content-URI reads must not block catalog writes or playback checkpoints.
pub fn backfill(
    core: &Arc<Mutex<Store>>,
    ready: &Arc<Mutex<bool>>,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    backfill_with(core, ready, |track| read(track, app))
}
fn backfill_with(
    core: &Arc<Mutex<Store>>,
    ready: &Arc<Mutex<bool>>,
    mut read: impl FnMut(&Track) -> Result<(Option<u32>, Option<u32>), String>,
) -> Result<(), String> {
    let mut ready = ready.lock().map_err(|e| e.to_string())?;
    if *ready {
        return Ok(());
    }
    let tracks = core.lock().map_err(|e| e.to_string())?.all_tracks()?;
    for old in tracks
        .into_iter()
        .filter(|t| !t.order_metadata_read && !t.demo)
    {
        if let Ok((track_number, disc_number)) = read(&old) {
            let mut store = core.lock().map_err(|e| e.to_string())?;
            if let Some(mut current) = store.track(&old.id)? {
                if !current.order_metadata_read && current.source_uri == old.source_uri {
                    current.track_number = track_number;
                    current.disc_number = disc_number;
                    current.order_metadata_read = true;
                    store.upsert_track(&current)?;
                }
            }
        }
    }
    // Unavailable sources retain their fallback order and can be retried next launch.
    *ready = true;
    Ok(())
}
fn read(track: &Track, app: &tauri::AppHandle) -> Result<(Option<u32>, Option<u32>), String> {
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        read_desktop(&track.source_uri)
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        let value: serde_json::Value = app
            .native_music()
            .call("albumOrder", serde_json::json!({"uri":track.source_uri}))?;
        let number = |key: &str| {
            value[key]
                .as_u64()
                .and_then(|n| u32::try_from(n).ok())
                .filter(|n| *n > 0)
        };
        Ok((number("trackNumber"), number("discNumber")))
    }
}

#[cfg(not(target_os = "android"))]
fn read_desktop(source: &str) -> Result<(Option<u32>, Option<u32>), String> {
    use lofty::{config::ParseOptions, file::TaggedFileExt, probe::Probe, tag::Accessor};
    let tagged = Probe::open(source)
        .map_err(|e| e.to_string())?
        .options(
            ParseOptions::new()
                .read_cover_art(false)
                .read_properties(false),
        )
        .read()
        .map_err(|e| e.to_string())?;
    let primary = tagged.primary_tag().or_else(|| tagged.first_tag());
    Ok((
        primary
            .and_then(|t| t.track())
            .or_else(|| tagged.tags().iter().find_map(|t| t.track()))
            .filter(|n| *n > 0),
        primary
            .and_then(|t| t.disk())
            .or_else(|| tagged.tags().iter().find_map(|t| t.disk()))
            .filter(|n| *n > 0),
    ))
}

#[cfg(all(test, not(target_os = "android")))]
mod tests {
    use super::*;
    use lofty::tag::{Accessor, Tag, TagExt, TagType};
    #[test]
    fn imports_and_backfills_tagged_wav_without_resetting_library_state() {
        let dir = std::env::temp_dir().join(format!("music-order-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let source = dir.join("legacy.wav");
        let mut bytes = vec![0u8; 46];
        bytes[0..4].copy_from_slice(b"RIFF");
        bytes[4..8].copy_from_slice(&38u32.to_le_bytes());
        bytes[8..16].copy_from_slice(b"WAVEfmt ");
        bytes[16..20].copy_from_slice(&16u32.to_le_bytes());
        bytes[20..22].copy_from_slice(&1u16.to_le_bytes());
        bytes[22..24].copy_from_slice(&1u16.to_le_bytes());
        bytes[24..28].copy_from_slice(&8000u32.to_le_bytes());
        bytes[28..32].copy_from_slice(&16000u32.to_le_bytes());
        bytes[32..34].copy_from_slice(&2u16.to_le_bytes());
        bytes[34..36].copy_from_slice(&16u16.to_le_bytes());
        bytes[36..40].copy_from_slice(b"data");
        bytes[40..44].copy_from_slice(&2u32.to_le_bytes());
        std::fs::write(&source, bytes).unwrap();
        let mut tag = Tag::new(TagType::Id3v2);
        tag.set_title("Tagged song".into());
        tag.set_album("Fixture Album".into());
        tag.set_track(10);
        tag.set_disk(2);
        tag.save_to_path(&source, lofty::config::WriteOptions::default())
            .unwrap();
        let mut imported = crate::catalog::read_file(&source, &dir).unwrap();
        assert_eq!(
            (imported.track_number, imported.disc_number),
            (Some(10), Some(2))
        );
        imported.track_number = None;
        imported.disc_number = None;
        imported.order_metadata_read = false;
        imported.favorite = true;
        let mut store = Store::open(":memory:").unwrap();
        store.upsert_track(&imported).unwrap();
        let core = Arc::new(Mutex::new(store));
        let ready = Arc::new(Mutex::new(false));
        backfill_with(&core, &ready, |t| read_desktop(&t.source_uri)).unwrap();
        let updated = core.lock().unwrap().track(&imported.id).unwrap().unwrap();
        assert_eq!(
            (updated.track_number, updated.disc_number),
            (Some(10), Some(2))
        );
        assert!(updated.favorite && updated.order_metadata_read);
        assert_eq!(updated.id, imported.id);
        backfill_with(&core, &ready, |_| panic!("metadata should be read once")).unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }
}
