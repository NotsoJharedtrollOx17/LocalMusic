use crate::state::{MusicState, Result};
use music_core::recommendation::{AcousticFeature, PlaylistContext};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::State;
#[cfg(target_os = "android")]
pub(crate) async fn refresh_sources(
    app: tauri::AppHandle,
    core: &Arc<Mutex<music_core::Store>>,
) -> Result<()> {
    use tauri_plugin_native_music::NativeMusicExt;
    let core = core.clone();
    tauri::async_runtime::spawn_blocking(move||{
        let tracks=core.lock().map_err(|e|e.to_string())?.all_tracks()?;
        let sources:Vec<_>=tracks.iter().filter(|t|t.available&&!t.hidden&&!t.demo).map(|t|serde_json::json!({"id":t.id,"uri":t.source_uri})).collect();
        let revisions:serde_json::Value=app.native_music().call("analysisSources",serde_json::json!({"payload":serde_json::to_string(&sources).map_err(|e|e.to_string())?}))?;
        let store=core.lock().map_err(|e|e.to_string())?;
        for t in &tracks{let key=format!("acoustic-source:{}",t.id);if let Some(revision)=revisions[&t.id].as_str(){store.set_setting(&key,&revision)?;}}
        Ok(())
    }).await.map_err(|e|e.to_string())?
}
fn millis() -> u64 {
    static START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_millis() as u64
}
#[derive(Default)]
pub(crate) struct AnalysisControl {
    lease: AtomicU64,
    epoch: AtomicU64,
    busy: AtomicBool,
    #[cfg(target_os = "android")]
    sources_ready: AtomicBool,
    failed: Mutex<HashMap<String, u64>>,
}
impl AnalysisControl {
    pub(crate) fn stop(&self) {
        self.lease.store(0, Ordering::Relaxed);
        self.epoch.fetch_add(1, Ordering::Relaxed);
    }
    fn allowed(&self, epoch: u64) -> bool {
        self.lease.load(Ordering::Relaxed) > millis() && self.epoch.load(Ordering::Relaxed) == epoch
    }
}
#[tauri::command]
pub(crate) async fn analysis_activity(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
    active: bool,
) -> Result<()> {
    #[cfg(not(target_os = "android"))]
    let active = {
        use tauri::Manager;
        active
            && !state.snapshot.lock().map_err(|e| e.to_string())?.playing
            && app.get_webview_window("main").is_some_and(|w| {
                w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(true)
            })
    };
    #[cfg(target_os = "android")]
    if active && !state.analysis.sources_ready.swap(true, Ordering::Relaxed) {
        if let Err(e) = refresh_sources(app.clone(), &state.core).await {
            state.analysis.sources_ready.store(false, Ordering::Relaxed);
            return Err(e);
        }
    }
    if active {
        state
            .analysis
            .lease
            .store(millis() + 4000, Ordering::Relaxed);
    } else {
        state.analysis.stop();
    }
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_native_music::NativeMusicExt;
        tauri::async_runtime::spawn_blocking(move || {
            app.native_music()
                .call::<serde_json::Value>("analysisActivity", serde_json::json!({"active":active}))
        })
        .await
        .map_err(|e| e.to_string())??;
    }
    #[cfg(not(target_os = "android"))]
    let _ = app;
    Ok(())
}
#[tauri::command]
pub(crate) async fn playlist_context(state: State<'_, MusicState>) -> Result<PlaylistContext> {
    let core = state.core.clone();
    let busy = state.analysis.busy.load(Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        core.lock()
            .map_err(|e| e.to_string())?
            .playlist_context(busy)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) fn set_suggestion_feedback(
    state: State<MusicState>,
    id: String,
    less: bool,
) -> Result<()> {
    state
        .core
        .lock()
        .map_err(|e| e.to_string())?
        .suggestion_feedback(&id, less)
}
#[tauri::command]
pub(crate) async fn analyze_next(
    app: tauri::AppHandle,
    state: State<'_, MusicState>,
) -> Result<()> {
    let control = state.analysis.clone();
    let epoch = control.epoch.load(Ordering::Relaxed);
    if !control.allowed(epoch) || control.busy.swap(true, Ordering::Relaxed) {
        return Ok(());
    }
    let core = state.core.clone();
    #[cfg(not(target_os = "android"))]
    let snapshot = state.snapshot.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<()> {
        struct Busy(Arc<AnalysisControl>);
        impl Drop for Busy {
            fn drop(&mut self) {
                self.0.busy.store(false, Ordering::Relaxed);
            }
        }
        let _guard = Busy(control.clone());
        let job = {
            let store = core.lock().map_err(|e| e.to_string())?;
            let data = store.recommendation_data()?;
            let order = music_core::recommendation::analysis_order(
                &store.all_tracks()?,
                &store.sessions()?,
            );
            let failed = control.failed.lock().map_err(|e| e.to_string())?;
            order.into_iter().find_map(|t| {
                let fingerprint = store.acoustic_fingerprint(&t).ok()?;
                if data.features.contains_key(&t.id)
                    || failed.get(&fingerprint).is_some_and(|at| millis() < *at)
                {
                    None
                } else {
                    Some((t, fingerprint))
                }
            })
        };
        let Some((track, fingerprint)) = job else {
            return Ok(());
        };
        let cancelled = || {
            #[cfg(not(target_os = "android"))]
            if snapshot.lock().map_or(true, |s| s.playing) {
                return true;
            }
            !control.allowed(epoch)
        };
        if cancelled() {
            return Ok(());
        }
        #[cfg(not(target_os = "android"))]
        let result = {
            let _ = &app;
            decode_desktop(
                &track.source_uri,
                track.duration_ms,
                &fingerprint,
                &cancelled,
            )
        };
        #[cfg(target_os = "android")]
        let result = {
            use tauri_plugin_native_music::NativeMusicExt;
            app.native_music()
                .call::<serde_json::Value>(
                    "analyzeTrack",
                    serde_json::json!({"uri":track.source_uri,"durationMs":track.duration_ms}),
                )
                .and_then(|v| {
                    if v["feature"].is_null() {
                        Ok(None)
                    } else {
                        let mut f: AcousticFeature = serde_json::from_value(v["feature"].clone())
                            .map_err(|e| e.to_string())?;
                        f.fingerprint = fingerprint.clone();
                        Ok(Some(f))
                    }
                })
        };
        if cancelled() {
            return Ok(());
        }
        match result {
            Ok(Some(f)) => {
                let store = core.lock().map_err(|e| e.to_string())?;
                if !cancelled() {
                    store.save_acoustic(&track.id, &f)?;
                }
            }
            Ok(None) | Err(_) => {
                control
                    .failed
                    .lock()
                    .map_err(|e| e.to_string())?
                    .insert(fingerprint, millis() + 300000);
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;
    result
}
#[cfg(not(target_os = "android"))]
fn decode_desktop(
    uri: &str,
    duration_ms: u64,
    fingerprint: &str,
    cancelled: &impl Fn() -> bool,
) -> Result<Option<AcousticFeature>> {
    #[cfg(windows)]
    let _priority = BackgroundPriority::new();
    use rodio::Source;
    let file = std::fs::File::open(uri).map_err(|e| e.to_string())?;
    let mut decoder = rodio::Decoder::try_from(file).map_err(|e| e.to_string())?;
    let rate = decoder.sample_rate().get();
    let channels = decoder.channels().get() as usize;
    if channels == 0 || channels > 8 {
        return Ok(None);
    }
    let duration = decoder
        .total_duration()
        .map(|d| d.as_secs_f64())
        .unwrap_or(duration_ms as f64 / 1000.0);
    let mut analysis = music_core::acoustic::AcousticAnalysis::default();
    let mut buffer = vec![vec![0f32; music_core::acoustic::N]; channels];
    for (start, end) in music_core::acoustic::excerpts(duration) {
        if cancelled() {
            return Ok(None);
        }
        decoder
            .try_seek(std::time::Duration::from_secs_f64(start))
            .map_err(|e| e.to_string())?;
        let frames = ((end - start) * rate as f64) as usize;
        for _ in 0..frames / music_core::acoustic::N {
            if cancelled() {
                return Ok(None);
            }
            for i in 0..music_core::acoustic::N {
                for c in &mut buffer {
                    let Some(v) = decoder.next() else {
                        return Ok(analysis.finish(fingerprint.to_string()));
                    };
                    c[i] = v;
                }
            }
            analysis.add(&buffer, rate);
            std::thread::yield_now();
        }
    }
    Ok(analysis.finish(fingerprint.to_string()))
}
#[cfg(windows)]
struct BackgroundPriority(i32);
#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn GetCurrentThread() -> isize;
    fn GetThreadPriority(thread: isize) -> i32;
    fn SetThreadPriority(thread: isize, priority: i32) -> i32;
}
#[cfg(windows)]
impl BackgroundPriority {
    fn new() -> Self {
        unsafe {
            let thread = GetCurrentThread();
            let old = GetThreadPriority(thread);
            SetThreadPriority(thread, -1);
            Self(old)
        }
    }
}
#[cfg(windows)]
impl Drop for BackgroundPriority {
    fn drop(&mut self) {
        unsafe {
            SetThreadPriority(GetCurrentThread(), self.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancelled_lease_cannot_be_revived_by_an_old_worker() {
        let control = AnalysisControl::default();
        control.lease.store(millis() + 4000, Ordering::Relaxed);
        let token = control.epoch.load(Ordering::Relaxed);
        assert!(control.allowed(token));
        control.stop();
        control.lease.store(millis() + 4000, Ordering::Relaxed);
        assert!(!control.allowed(token));
        assert!(control.allowed(control.epoch.load(Ordering::Relaxed)));
    }
    #[cfg(not(target_os = "android"))]
    #[test]
    fn source_decoder_is_silent_bounded_and_cooperatively_cancelled() {
        let path =
            std::env::temp_dir().join(format!("playlist-analysis-{}.wav", uuid::Uuid::new_v4()));
        let rate = 16000u32;
        let count = rate;
        let mut wav = Vec::new();
        wav.extend(b"RIFF");
        wav.extend((36 + count * 2).to_le_bytes());
        wav.extend(b"WAVEfmt ");
        wav.extend(16u32.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(rate.to_le_bytes());
        wav.extend((rate * 2).to_le_bytes());
        wav.extend(2u16.to_le_bytes());
        wav.extend(16u16.to_le_bytes());
        wav.extend(b"data");
        wav.extend((count * 2).to_le_bytes());
        for i in 0..count {
            let v = ((i as f64 * 2.0 * std::f64::consts::PI * 1000.0 / rate as f64).sin() * 3000.0)
                as i16;
            wav.extend(v.to_le_bytes());
        }
        std::fs::write(&path, wav).unwrap();
        let feature = decode_desktop(path.to_str().unwrap(), 1000, "fixture", &|| false)
            .unwrap()
            .unwrap();
        assert!(feature.valid());
        assert!(feature.seconds <= 1.0);
        assert!(
            decode_desktop(path.to_str().unwrap(), 1000, "fixture", &|| true)
                .unwrap()
                .is_none()
        );
        std::fs::remove_file(path).unwrap();
    }
}
