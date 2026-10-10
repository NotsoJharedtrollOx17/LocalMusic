//! Shared native state and startup of the catalog and platform player.
#[cfg(not(target_os = "android"))]
use crate::playback::desktop;
use music_core::{PlaybackSnapshot, Store};
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::Manager;

pub(crate) struct MusicState {
    pub(crate) core: Arc<Mutex<Store>>,
    pub(crate) order_ready: Arc<Mutex<bool>>,
    pub(crate) snapshot: Arc<Mutex<PlaybackSnapshot>>,
    pub(crate) cancel: Arc<AtomicBool>,
    #[cfg(not(target_os = "android"))]
    pub(crate) sound: Arc<crate::sound::engine::Engine>,
    #[cfg(not(target_os = "android"))]
    pub(crate) player: std::sync::mpsc::Sender<desktop::Request>,
}
pub(crate) type Result<T> = std::result::Result<T, String>;

pub(crate) fn setup(app: &mut tauri::App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    crate::webview_policy::configure(app)?;
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let core = Arc::new(Mutex::new(
        Store::open(dir.join("music.sqlite")).map_err(std::io::Error::other)?,
    ));
    let snapshot = Arc::new(Mutex::new(PlaybackSnapshot {
        repeat: "off".into(),
        ..Default::default()
    }));
    #[cfg(not(target_os = "android"))]
    let sound = Arc::new(crate::sound::engine::Engine::new(
        core.lock()
            .unwrap()
            .get_setting("sound-v1")?
            .unwrap_or_default(),
    ));
    #[cfg(not(target_os = "android"))]
    let player = desktop::launch(
        app.handle().clone(),
        core.clone(),
        snapshot.clone(),
        sound.clone(),
    );
    app.manage(MusicState {
        core,
        order_ready: Arc::new(Mutex::new(false)),
        snapshot,
        cancel: Arc::new(AtomicBool::new(false)),
        #[cfg(not(target_os = "android"))]
        player,
        #[cfg(not(target_os = "android"))]
        sound,
    });
    Ok(())
}
