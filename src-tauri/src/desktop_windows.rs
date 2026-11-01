//! Desktop window ownership. Only fixed local views can be opened.
use crate::state::Result;
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};
use tauri::{Emitter, Manager};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum View {
    Player,
    Visualizer,
    Equalizer,
}
impl View {
    pub fn label(self) -> &'static str {
        match self {
            Self::Player => "player",
            Self::Visualizer => "visualizer",
            Self::Equalizer => "equalizer",
        }
    }
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub view: View,
    pub phase: String,
    pub generation: u64,
    pub queue: bool,
    pub pinned: bool,
    #[serde(skip)]
    dismiss_on_close: bool,
}
impl Entry {
    fn begin_return(&mut self, dismiss: bool) {
        self.phase = "returning".into();
        self.dismiss_on_close |= dismiss;
    }
    fn acknowledge_ready(&mut self, caller: &str, generation: u64) -> bool {
        if caller != self.view.label() || generation != self.generation || self.phase != "opening" {
            return false;
        }
        self.phase = "transferring".into();
        true
    }
    fn release(&mut self, caller: &str, generation: u64) -> bool {
        if generation != self.generation {
            return false;
        }
        if self.phase == "transferring" && caller == "main" {
            self.phase = "detached".into();
            return true;
        }
        self.phase == "returning" && caller == self.view.label()
    }
}
#[derive(Default)]
pub struct Windows {
    pub entries: Mutex<Vec<Entry>>,
    pub serial: AtomicU64,
    pub shutting_down: AtomicBool,
    #[cfg(windows)]
    bounds: Mutex<
        std::collections::HashMap<String, (tauri::PhysicalPosition<i32>, tauri::PhysicalSize<u32>)>,
    >,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "op")]
pub enum Action {
    Open { view: View, queue: bool },
    Ready { view: View, generation: u64 },
    Released { view: View, generation: u64 },
    Return { view: View },
    Dismiss { view: View },
    Pin { view: View, value: bool },
    Queue { value: bool },
    Appearance { dark: bool },
    Navigate { kind: String, track_id: String },
}
fn valid_caller(label: &str) -> Result<()> {
    if ["main", "player", "visualizer", "equalizer"].contains(&label) {
        Ok(())
    } else {
        Err("Unknown window".into())
    }
}
fn state(app: &tauri::AppHandle) -> Vec<Entry> {
    app.state::<Windows>().entries.lock().unwrap().clone()
}
fn publish(app: &tauri::AppHandle) {
    let _ = app.emit("desktop://windows", state(app));
}
pub fn visualizer_allowed(app: &tauri::AppHandle, caller: &str) -> bool {
    let s = app.state::<Windows>();
    let entries = s.entries.lock().unwrap();
    match entries.iter().find(|e| e.view == View::Visualizer) {
        Some(e) if e.phase == "detached" => caller == "visualizer",
        Some(e) if e.phase == "transferring" || e.phase == "returning" => false,
        _ => caller == "main",
    }
}
#[tauri::command]
pub fn desktop_state(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<serde_json::Value> {
    valid_caller(window.label())?;
    Ok(
        serde_json::json!({"supported":cfg!(windows),"windows":state(&app),"revision":app.state::<Windows>().serial.load(Ordering::SeqCst)}),
    )
}
#[tauri::command]
pub fn desktop_changed(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    domain: String,
    ids: Option<Vec<String>>,
) -> Result<()> {
    valid_caller(window.label())?;
    if ![
        "catalog",
        "playlists",
        "feedback",
        "privacy",
        "settings",
        "sound",
    ]
    .contains(&domain.as_str())
    {
        return Err("Unknown change".into());
    }
    let revision = app.state::<Windows>().serial.fetch_add(1, Ordering::SeqCst) + 1;
    app.emit(
        "desktop://changed",
        serde_json::json!({"domain":domain,"revision":revision,"source":window.label(),"ids":ids.unwrap_or_default().into_iter().take(256).collect::<Vec<_>>()}),
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn desktop_action(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    action: Action,
) -> Result<()> {
    if window.label() == "about" {
        if !matches!(action, Action::Appearance { .. }) {
            return Err("About only synchronizes appearance".into());
        }
    } else {
        valid_caller(window.label())?;
    }
    #[cfg(windows)]
    {
        perform(&app, window.label(), action)
    }
    #[cfg(not(windows))]
    {
        let _ = (app, window, action);
        Err("Separate windows are available on Windows".into())
    }
}
#[cfg(windows)]
fn perform(app: &tauri::AppHandle, caller: &str, action: Action) -> Result<()> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let registry = app.state::<Windows>();
    if registry.shutting_down.load(Ordering::SeqCst) {
        return Ok(());
    }
    match action {
        Action::Open { view, queue } => {
            if let Some(w) = app.get_webview_window(view.label()) {
                if view == View::Player {
                    if let Some(entry) = registry
                        .entries
                        .lock()
                        .unwrap()
                        .iter_mut()
                        .find(|e| e.view == view)
                    {
                        entry.queue = queue;
                    }
                    publish(app);
                }
                w.unminimize().ok();
                w.set_focus().ok();
                return Ok(());
            }
            let generation = registry.serial.fetch_add(1, Ordering::SeqCst) + 1;
            {
                let mut entries = registry.entries.lock().unwrap();
                if entries.iter().any(|e| e.view == view) {
                    return Ok(());
                }
                entries.push(Entry {
                    view,
                    phase: "opening".into(),
                    generation,
                    queue,
                    pinned: false,
                    dismiss_on_close: false,
                });
            }
            let (width, height) = match view {
                View::Player => (720., 860.),
                View::Visualizer => (1100., 720.),
                View::Equalizer => (940., 760.),
            };
            let result = (|| -> tauri::Result<()> {
                let mut builder = WebviewWindowBuilder::new(
                    app,
                    view.label(),
                    WebviewUrl::App(
                        format!(
                            "index.html?companion={}&generation={generation}",
                            view.label()
                        )
                        .into(),
                    ),
                )
                .title(match view {
                    View::Player => "Local Music - Now playing",
                    View::Visualizer => "Local Music - Visualizer",
                    View::Equalizer => "Local Music - Equalizer",
                })
                .visible(false)
                .inner_size(width, height)
                .min_inner_size(360., 480.)
                .resizable(true)
                .decorations(true)
                .devtools(false)
                .zoom_hotkeys_enabled(true);
                let monitor = app
                    .get_webview_window("main")
                    .and_then(|w| w.current_monitor().ok().flatten());
                if let Some(m) = monitor {
                    let area = m.work_area();
                    let scale = m.scale_factor();
                    let maxw = area.size.width as f64 / scale;
                    let maxh = area.size.height as f64 / scale;
                    builder = builder
                        .inner_size(width.min(maxw), height.min(maxh))
                        .position(
                            area.position.x as f64 / scale + ((maxw - width).max(0.) / 2.),
                            area.position.y as f64 / scale + ((maxh - height).max(0.) / 2.),
                        );
                }
                let w = builder.build()?;
                if let Some((pos, size)) =
                    registry.bounds.lock().unwrap().get(view.label()).copied()
                {
                    if let Ok(monitors) = w.available_monitors() {
                        if let Some(m) = monitors.iter().find(|m| {
                            let a = m.work_area();
                            pos.x >= a.position.x
                                && pos.y >= a.position.y
                                && pos.x + 80 < (a.position.x + a.size.width as i32)
                                && pos.y + 80 < (a.position.y + a.size.height as i32)
                        }) {
                            let area = m.work_area();
                            w.set_size(tauri::PhysicalSize::new(
                                size.width.min(area.size.width),
                                size.height.min(area.size.height),
                            ))?;
                            let outer = w.outer_size()?;
                            w.set_position(tauri::PhysicalPosition::new(
                                pos.x
                                    .min(
                                        area.position.x + area.size.width as i32
                                            - outer.width as i32,
                                    )
                                    .max(area.position.x),
                                pos.y
                                    .min(
                                        area.position.y + area.size.height as i32
                                            - outer.height as i32,
                                    )
                                    .max(area.position.y),
                            ))?;
                        }
                    }
                }
                // Fit the outer decorated window, not only its content dimensions.
                if let Some(m) = w.current_monitor()? {
                    let area = m.work_area();
                    let outer = w.outer_size()?;
                    let inner = w.inner_size()?;
                    let chrome_w = outer.width.saturating_sub(inner.width);
                    let chrome_h = outer.height.saturating_sub(inner.height);
                    w.set_size(tauri::PhysicalSize::new(
                        inner.width.min(area.size.width.saturating_sub(chrome_w)),
                        inner.height.min(area.size.height.saturating_sub(chrome_h)),
                    ))?;
                    let outer = w.outer_size()?;
                    let pos = w.outer_position()?;
                    w.set_position(tauri::PhysicalPosition::new(
                        pos.x
                            .min(area.position.x + area.size.width as i32 - outer.width as i32)
                            .max(area.position.x),
                        pos.y
                            .min(area.position.y + area.size.height as i32 - outer.height as i32)
                            .max(area.position.y),
                    ))?;
                }
                crate::webview_policy::configure_window(&w)?;
                Ok(())
            })();
            if let Err(error) = result {
                registry.entries.lock().unwrap().retain(|e| e.view != view);
                if let Some(w) = app.get_webview_window(view.label()) {
                    w.destroy().ok();
                }
                publish(app);
                return Err(error.to_string());
            }
            publish(app);
            let handle = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(12));
                let s = handle.state::<Windows>();
                let failed = {
                    let mut entries = s.entries.lock().unwrap();
                    entries
                        .iter()
                        .position(|e| {
                            e.view == view && e.generation == generation && e.phase != "detached"
                        })
                        .map(|index| entries.remove(index))
                };
                if let Some(entry) = failed {
                    if let Some(w) = handle.get_webview_window(view.label()) {
                        w.destroy().ok();
                    }
                    publish(&handle);
                    if entry.phase == "transferring" {
                        let _ = handle.emit_to("main", "desktop://returned", entry);
                    }
                    let _ = handle.emit_to(
                        "main",
                        "desktop://error",
                        "Separate window could not start. Please try again.",
                    );
                }
            });
        }
        Action::Ready { view, generation } => {
            if caller != view.label() {
                return Err("Window mismatch".into());
            }
            if let Some(e) = registry
                .entries
                .lock()
                .unwrap()
                .iter_mut()
                .find(|e| e.view == view)
            {
                e.acknowledge_ready(caller, generation);
            }
            publish(app);
        }
        Action::Released { view, generation } => {
            let phase = registry
                .entries
                .lock()
                .unwrap()
                .iter()
                .find(|e| e.view == view && e.generation == generation)
                .map(|e| e.phase.clone());
            if phase.as_deref() == Some("transferring") && caller == "main" {
                if let Some(e) = registry
                    .entries
                    .lock()
                    .unwrap()
                    .iter_mut()
                    .find(|e| e.view == view)
                {
                    e.release(caller, generation);
                }
                if let Some(w) = app.get_webview_window(view.label()) {
                    if let Err(error) = w.show() {
                        finish_return(app, view);
                        return Err(error.to_string());
                    }
                    w.set_focus().ok();
                }
                publish(app);
            } else if phase.as_deref() == Some("returning") && caller == view.label() {
                finish_return(app, view);
            }
        }
        Action::Return { view } => {
            if caller != "main" && caller != view.label() {
                return Err("Window mismatch".into());
            }
            begin_return(app, view, false);
        }
        Action::Dismiss { view } => {
            if caller != view.label() {
                return Err("Window mismatch".into());
            }
            begin_return(app, view, true);
        }
        Action::Pin { view, value } => {
            if caller != view.label() {
                return Err("Window mismatch".into());
            }
            if let Some(w) = app.get_webview_window(view.label()) {
                w.set_always_on_top(value).map_err(|e| e.to_string())?;
            }
            if let Some(e) = registry
                .entries
                .lock()
                .unwrap()
                .iter_mut()
                .find(|e| e.view == view)
            {
                e.pinned = value;
            }
            publish(app);
        }
        Action::Appearance { dark } => {
            if let Some(w) = app.get_webview_window(caller) {
                let preferences = app
                    .state::<crate::state::MusicState>()
                    .core
                    .lock()
                    .map_err(|e| e.to_string())?
                    .get_setting::<music_core::Settings>("preferences")?
                    .unwrap_or_default();
                let language = preferences.language;
                let title = match (caller, language.as_str()) {
                    ("player", "es") => "Local Music - Reproduciendo",
                    ("visualizer", "es") => "Local Music - Visualizador",
                    ("equalizer", "es") => "Local Music - Ecualizador",
                    ("about", "es") => "Local Music - Acerca de Local Music",
                    ("player", _) => "Local Music - Now playing",
                    ("visualizer", _) => "Local Music - Visualizer",
                    ("equalizer", _) => "Local Music - Equalizer",
                    ("about", _) => "Local Music - About Local Music",
                    (_, "es") => "Local Music - Tu resumen",
                    _ => "Local Music - Your Recap",
                };
                w.set_title(title).map_err(|e| e.to_string())?;
                w.set_theme(if preferences.theme == "system" {
                    None
                } else {
                    Some(if dark {
                        tauri::Theme::Dark
                    } else {
                        tauri::Theme::Light
                    })
                })
                .map_err(|e| e.to_string())?;
                w.set_background_color(Some(if dark {
                    tauri::window::Color(20, 22, 21, 255)
                } else {
                    tauri::window::Color(250, 248, 244, 255)
                }))
                .map_err(|e| e.to_string())?;
            }
        }
        Action::Queue { value } => {
            if caller != "player" {
                return Err("Window mismatch".into());
            }
            if let Some(e) = registry
                .entries
                .lock()
                .unwrap()
                .iter_mut()
                .find(|e| e.view == View::Player)
            {
                e.queue = value;
            }
            publish(app);
        }
        Action::Navigate { kind, track_id } => {
            if caller != "player" || !["albums", "artists", "visualizer"].contains(&kind.as_str()) {
                return Err("Invalid navigation".into());
            }
            if kind == "visualizer" {
                if let Some(w) = app.get_webview_window("visualizer") {
                    w.unminimize().ok();
                    w.set_focus().ok();
                    return Ok(());
                }
            }
            if let Some(w) = app.get_webview_window("main") {
                w.unminimize().ok();
                w.show().ok();
                w.set_focus().ok();
            }
            app.emit_to(
                "main",
                "desktop://navigate",
                serde_json::json!({"kind":kind,"trackId":track_id}),
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
#[cfg(windows)]
fn begin_return(app: &tauri::AppHandle, view: View, dismiss: bool) {
    let registry = app.state::<Windows>();
    if registry.shutting_down.load(Ordering::SeqCst) {
        return;
    }
    if let Some(e) = registry
        .entries
        .lock()
        .unwrap()
        .iter_mut()
        .find(|e| e.view == view)
    {
        e.begin_return(dismiss);
    }
    if let Some(w) = app.get_webview_window(view.label()) {
        w.hide().ok();
    }
    publish(app);
}
#[cfg(windows)]
fn finish_return(app: &tauri::AppHandle, view: View) {
    let registry = app.state::<Windows>();
    let entry = {
        let mut entries = registry.entries.lock().unwrap();
        entries
            .iter()
            .position(|e| e.view == view)
            .map(|i| entries.remove(i))
    };
    if entry.is_none() {
        return;
    }
    if let Some(w) = app.get_webview_window(view.label()) {
        if let (Ok(p), Ok(s)) = (w.outer_position(), w.inner_size()) {
            registry
                .bounds
                .lock()
                .unwrap()
                .insert(view.label().into(), (p, s));
        }
        w.destroy().ok();
    }
    publish(app);
    if registry.shutting_down.load(Ordering::SeqCst) {
        return;
    }
    if let Some(e) = entry.filter(|e| !e.dismiss_on_close) {
        if let Some(w) = app.get_webview_window("main") {
            w.unminimize().ok();
            w.show().ok();
            w.set_focus().ok();
        }
        let _ = app.emit_to("main", "desktop://returned", e);
    }
}
pub fn window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    #[cfg(windows)]
    {
        let app = window.app_handle();
        let registry = app.state::<Windows>();
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if window.label() == "main" {
                registry.shutting_down.store(true, Ordering::SeqCst);
                for label in ["player", "visualizer", "equalizer", "about"] {
                    if let Some(w) = app.get_webview_window(label) {
                        w.destroy().ok();
                    }
                }
                app.exit(0);
            } else if let Some(view) = view_for_label(window.label()) {
                api.prevent_close();
                begin_return(app, view, true);
            }
        }
        if matches!(event, tauri::WindowEvent::Destroyed)
            && !registry.shutting_down.load(Ordering::SeqCst)
        {
            if let Some(view) = view_for_label(window.label()) {
                finish_return(app, view);
            }
        }
    }
    #[cfg(not(windows))]
    let _ = (window, event);
}
fn view_for_label(label: &str) -> Option<View> {
    match label {
        "player" => Some(View::Player),
        "visualizer" => Some(View::Visualizer),
        "equalizer" => Some(View::Equalizer),
        _ => None,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn entry() -> Entry {
        Entry {
            view: View::Visualizer,
            phase: "opening".into(),
            generation: 3,
            queue: false,
            pinned: false,
            dismiss_on_close: false,
        }
    }
    #[test]
    fn handoff_requires_current_generation_and_source_release() {
        let mut e = entry();
        assert!(!e.acknowledge_ready("main", 3));
        assert!(!e.acknowledge_ready("visualizer", 2));
        assert!(e.acknowledge_ready("visualizer", 3));
        assert_eq!(e.phase, "transferring");
        assert!(!e.release("player", 3));
        assert!(!e.release("main", 2));
        assert!(e.release("main", 3));
        assert_eq!(e.phase, "detached");
        assert!(!e.acknowledge_ready("visualizer", 3));
    }
    #[test]
    fn return_requires_owning_view_and_ignores_stale_cleanup() {
        let mut e = entry();
        e.phase = "returning".into();
        assert!(!e.release("main", 3));
        assert!(!e.release("visualizer", 2));
        assert!(e.release("visualizer", 3));
    }
    #[test]
    fn native_close_dismisses_while_explicit_return_restores() {
        let mut explicit = entry();
        explicit.begin_return(false);
        assert!(!explicit.dismiss_on_close);
        let mut closed = entry();
        closed.begin_return(true);
        closed.begin_return(false);
        assert!(closed.dismiss_on_close);
        assert!(closed.release("visualizer", 3));
    }
    #[test]
    fn navigation_uses_the_frontend_camel_case_contract() {
        let action = serde_json::from_str::<Action>(
            r#"{"op":"navigate","kind":"visualizer","trackId":"song"}"#,
        )
        .unwrap();
        assert!(matches!(action,Action::Navigate{track_id,..} if track_id=="song"));
    }
    #[test]
    fn only_known_local_windows_and_views_are_accepted() {
        assert!(valid_caller("main").is_ok());
        assert!(valid_caller("player").is_ok());
        assert!(valid_caller("equalizer").is_ok());
        assert!(valid_caller("external").is_err());
        assert_eq!(view_for_label("visualizer"), Some(View::Visualizer));
        assert_eq!(view_for_label("equalizer"), Some(View::Equalizer));
        assert!(matches!(
            serde_json::from_str::<Action>(r#"{"op":"open","view":"equalizer","queue":false}"#)
                .unwrap(),
            Action::Open {
                view: View::Equalizer,
                ..
            }
        ));
        assert!(serde_json::from_str::<Action>(
            r#"{"op":"open","view":"https://example.org","queue":false}"#
        )
        .is_err());
    }
}
