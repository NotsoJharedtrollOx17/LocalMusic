//! Fixed, main-window-only native commands. No catalog or playback ownership.
use crate::state::Result;
use serde::{Deserialize, Serialize};

pub const COMMANDS: &[&str] = &[
    "import",
    "new-playlist",
    "settings",
    "exit",
    "songs",
    "albums",
    "artists",
    "playlists",
    "year",
    "search",
    "toggle",
    "previous",
    "next",
    "shuffle",
    "repeat-off",
    "repeat-all",
    "repeat-one",
    "player",
    "queue",
    "detach-player",
    "visualizer",
    "equalizer",
    "help",
    "about",
];
#[derive(Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MenuState {
    revision: u64,
    language: String,
    section: String,
    playing: bool,
    shuffle: bool,
    repeat: String,
    enabled: Vec<String>,
}
impl MenuState {
    fn validate(&self, caller: &str) -> Result<()> {
        if caller != "main" {
            return Err("Only the main window owns the menu".into());
        }
        if !["en", "es"].contains(&self.language.as_str())
            || !["songs", "albums", "artists", "playlists", "year"].contains(&self.section.as_str())
            || !["off", "all", "one"].contains(&self.repeat.as_str())
            || self.enabled.len() > COMMANDS.len()
            || self
                .enabled
                .iter()
                .any(|id| !COMMANDS.contains(&id.as_str()))
        {
            return Err("Invalid desktop menu state".into());
        }
        Ok(())
    }
    fn checked(&self, id: &str) -> bool {
        id == self.section
            || (id == "shuffle" && self.shuffle)
            || id.strip_prefix("repeat-").is_some_and(|r| r == self.repeat)
    }
    fn allows(&self, id: &str) -> bool {
        COMMANDS.contains(&id) && (id == "exit" || self.enabled.iter().any(|e| e == id))
    }
}
#[derive(Serialize)]
pub struct Status {
    supported: bool,
    ready: bool,
    version: String,
}

#[derive(Default)]
pub struct DesktopMenu {
    #[cfg(windows)]
    inner: std::sync::Mutex<Option<native::Installed>>,
}

#[cfg(any(windows, test))]
pub(crate) fn shortcut(key: u32, control: bool, alt: bool, shift: bool) -> Option<&'static str> {
    if !control || alt || shift {
        return None;
    }
    match key {
        0x4f => Some("import"),
        0x4e => Some("new-playlist"),
        0x46 => Some("search"),
        0xbc => Some("settings"),
        _ => None,
    }
}

/// WebView2 consumes some native menu accelerators while an editor has focus.
/// Handle that path once on its UI thread, retaining the same native eligibility.
#[cfg(windows)]
pub(crate) fn accelerator(window: &tauri::WebviewWindow, id: &str, pressed: bool) -> bool {
    use tauri::{Emitter, Manager};
    if window.label() != "main" {
        return false;
    }
    let registry = window.state::<DesktopMenu>();
    let guard = registry.inner.lock().unwrap();
    let Some(menu) = guard.as_ref() else {
        return false;
    };
    let (allowed, revision) = menu.command_state(id);
    drop(guard);
    if allowed && pressed {
        let _ = window.emit(
            "desktop://menu",
            serde_json::json!({"command":id,"revision":revision}),
        );
    }
    true
}

#[tauri::command]
pub fn desktop_menu_sync(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: MenuState,
) -> Result<Status> {
    state.validate(window.label())?;
    #[cfg(windows)]
    native::sync(&app, &window, state)?;
    Ok(Status {
        supported: cfg!(windows),
        ready: cfg!(windows),
        version: app.package_info().version.to_string(),
    })
}

#[cfg(windows)]
mod native {
    use super::*;
    use tauri::{
        menu::{
            CheckMenuItem, IsMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu,
        },
        Emitter, Manager,
    };
    pub(super) struct Installed {
        _menu: Menu<tauri::Wry>,
        items: Vec<(&'static str, MenuItemKind<tauri::Wry>)>,
        groups: Vec<(&'static str, Submenu<tauri::Wry>)>,
        state: MenuState,
    }
    impl Installed {
        pub(super) fn command_state(&self, id: &str) -> (bool, u64) {
            (self.state.allows(id), self.state.revision)
        }
    }
    fn text(id: &str, es: bool, playing: bool) -> &'static str {
        match (id, es) {
            ("file", false) => "&File",
            ("file", true) => "&Archivo",
            ("library", false) => "&Library",
            ("library", true) => "&Biblioteca",
            ("playback", false) => "&Playback",
            ("playback", true) => "&Reproducción",
            ("window", false) => "&Window",
            ("window", true) => "&Ventana",
            ("help-menu", false) => "&Help",
            ("help-menu", true) => "A&yuda",
            ("import", false) => "&Import music…",
            ("import", true) => "&Importar música…",
            ("new-playlist", false) => "&New playlist…",
            ("new-playlist", true) => "&Nueva playlist…",
            ("settings", false) => "&Settings…",
            ("settings", true) => "&Ajustes…",
            ("exit", false) => "E&xit",
            ("exit", true) => "&Salir",
            ("songs", false) => "&Songs",
            ("songs", true) => "&Canciones",
            ("albums", false) => "&Albums",
            ("albums", true) => "Ál&bumes",
            ("artists", false) => "A&rtists",
            ("artists", true) => "A&rtistas",
            ("playlists", _) => "&Playlists",
            ("year", false) => "&Your Recap",
            ("year", true) => "&Tu resumen",
            ("search", false) => "S&earch current view",
            ("search", true) => "B&uscar en esta vista",
            ("toggle", false) if playing => "&Pause",
            ("toggle", true) if playing => "&Pausar",
            ("toggle", false) => "&Play",
            ("toggle", true) => "&Reproducir",
            ("previous", false) => "Pre&vious",
            ("previous", true) => "&Anterior",
            ("next", false) => "&Next",
            ("next", true) => "&Siguiente",
            ("shuffle", false) => "&Shuffle",
            ("shuffle", true) => "A&leatorio",
            ("repeat", false) => "&Repeat",
            ("repeat", true) => "R&epetir",
            ("repeat-off", false) => "&Off",
            ("repeat-off", true) => "&Desactivado",
            ("repeat-all", false) => "&All",
            ("repeat-all", true) => "&Todo",
            ("repeat-one", false) => "&One",
            ("repeat-one", true) => "&Una",
            ("player", false) => "&Now Playing",
            ("player", true) => "&Reproduciendo",
            ("queue", false) => "&Queue",
            ("queue", true) => "&Cola",
            ("detach-player", false) => "Open Now Playing in &separate window",
            ("detach-player", true) => "Abrir Reproduciendo en una ventana &independiente",
            ("visualizer", false) => "&Visualizer",
            ("visualizer", true) => "&Visualizador",
            ("equalizer", false) => "&Equalizer",
            ("equalizer", true) => "&Ecualizador",
            ("help", false) => "&Help and keyboard shortcuts…",
            ("help", true) => "&Ayuda y atajos de teclado…",
            ("about", false) => "&About Local Music…",
            ("about", true) => "A&cerca de Local Music…",
            _ => "",
        }
    }
    fn build(app: &tauri::AppHandle, state: &MenuState) -> tauri::Result<Installed> {
        let menu = Menu::new(app)?;
        let mut installed = Installed {
            _menu: menu.clone(),
            items: vec![],
            groups: vec![],
            state: state.clone(),
        };
        for (id, ids) in [
            (
                "file",
                vec!["import", "new-playlist", "-", "settings", "-", "exit"],
            ),
            (
                "library",
                vec![
                    "songs",
                    "albums",
                    "artists",
                    "playlists",
                    "year",
                    "-",
                    "search",
                ],
            ),
            (
                "playback",
                vec!["toggle", "previous", "next", "-", "shuffle", "repeat"],
            ),
            (
                "window",
                vec![
                    "player",
                    "queue",
                    "detach-player",
                    "-",
                    "visualizer",
                    "equalizer",
                ],
            ),
            ("help-menu", vec!["help", "about"]),
        ] {
            let group = Submenu::with_id(
                app,
                format!("menu-{id}"),
                text(id, state.language == "es", state.playing),
                true,
            )?;
            for item in ids {
                if item == "-" {
                    group.append(&PredefinedMenuItem::separator(app)?)?;
                } else if item == "repeat" {
                    let repeat = Submenu::with_id(
                        app,
                        "menu-repeat",
                        text("repeat", state.language == "es", false),
                        true,
                    )?;
                    for id in ["repeat-off", "repeat-all", "repeat-one"] {
                        add(app, &repeat, id, &mut installed)?;
                    }
                    group.append(&repeat)?;
                    installed.groups.push(("repeat", repeat));
                } else {
                    add(app, &group, item, &mut installed)?;
                }
            }
            menu.append(&group)?;
            installed.groups.push((id, group));
        }
        Ok(installed)
    }
    fn add(
        app: &tauri::AppHandle,
        group: &Submenu<tauri::Wry>,
        id: &'static str,
        menu: &mut Installed,
    ) -> tauri::Result<()> {
        let state = &menu.state;
        let label = text(id, state.language == "es", state.playing);
        let accelerator = match id {
            "import" => Some("Ctrl+O"),
            "new-playlist" => Some("Ctrl+N"),
            "search" => Some("Ctrl+F"),
            "settings" => Some("Ctrl+,"),
            _ => None,
        };
        let item = if [
            "songs",
            "albums",
            "artists",
            "playlists",
            "year",
            "shuffle",
            "repeat-off",
            "repeat-all",
            "repeat-one",
        ]
        .contains(&id)
        {
            CheckMenuItem::with_id(
                app,
                id,
                label,
                state.allows(id),
                state.checked(id),
                accelerator,
            )?
            .kind()
        } else {
            MenuItem::with_id(app, id, label, state.allows(id), accelerator)?.kind()
        };
        match &item {
            MenuItemKind::MenuItem(i) => group.append(i)?,
            MenuItemKind::Check(i) => group.append(i)?,
            _ => unreachable!(),
        }
        menu.items.push((id, item));
        Ok(())
    }
    pub(super) fn sync(
        app: &tauri::AppHandle,
        window: &tauri::WebviewWindow,
        state: MenuState,
    ) -> Result<()> {
        let registry = app.state::<DesktopMenu>();
        let mut guard = registry.inner.lock().unwrap();
        if guard.is_none() {
            let installed = build(app, &state).map_err(|e| e.to_string())?;
            window
                .set_menu(installed._menu.clone())
                .map_err(|e| e.to_string())?;
            window.on_menu_event(|w, event| {
                if w.label() != "main" {
                    return;
                }
                let registry = w.state::<DesktopMenu>();
                let guard = registry.inner.lock().unwrap();
                let Some(menu) = guard.as_ref() else {
                    return;
                };
                let id = event.id().as_ref();
                // Native check items toggle themselves; restore confirmed state until playback/navigation succeeds.
                for (key, item) in &menu.items {
                    if let MenuItemKind::Check(i) = item {
                        let _ = i.set_checked(menu.state.checked(key));
                    }
                }
                if !menu.state.allows(id) {
                    return;
                }
                if id == "exit" {
                    drop(guard);
                    let _ = w.close();
                } else {
                    let _ = w.emit(
                        "desktop://menu",
                        serde_json::json!({"command":id,"revision":menu.state.revision}),
                    );
                }
            });
            *guard = Some(installed);
            return Ok(());
        }
        let menu = guard.as_mut().unwrap();
        if state.revision <= menu.state.revision {
            return Ok(());
        }
        for (id, group) in &menu.groups {
            group
                .set_text(text(id, state.language == "es", state.playing))
                .map_err(|e| e.to_string())?;
        }
        for (id, item) in &menu.items {
            let label = text(id, state.language == "es", state.playing);
            match item {
                MenuItemKind::MenuItem(i) => {
                    i.set_text(label)
                        .and_then(|_| i.set_enabled(state.allows(id)))
                        .map_err(|e| e.to_string())?;
                }
                MenuItemKind::Check(i) => {
                    i.set_text(label)
                        .and_then(|_| i.set_enabled(state.allows(id)))
                        .and_then(|_| i.set_checked(state.checked(id)))
                        .map_err(|e| e.to_string())?;
                }
                _ => {}
            }
        }
        menu.state = state;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> MenuState {
        MenuState {
            language: "en".into(),
            section: "songs".into(),
            repeat: "off".into(),
            enabled: vec!["toggle".into()],
            ..Default::default()
        }
    }
    #[test]
    fn accelerators_are_exact_and_leave_editing_and_zoom_alone() {
        for (key, command) in [
            (0x4f, "import"),
            (0x4e, "new-playlist"),
            (0x46, "search"),
            (0xbc, "settings"),
        ] {
            assert_eq!(shortcut(key, true, false, false), Some(command));
            assert_eq!(shortcut(key, true, true, false), None);
            assert_eq!(shortcut(key, true, false, true), None);
            assert_eq!(shortcut(key, false, false, false), None);
        }
        for key in [0x43, 0x56, 0x58, 0x41, 0xbb, 0xbd, 0x30, 0x20] {
            assert_eq!(shortcut(key, true, false, false), None);
        }
    }
    #[test]
    fn fixed_main_only_contract() {
        let s = state();
        assert!(s.validate("main").is_ok());
        for caller in ["player", "visualizer", "equalizer", "unknown"] {
            assert!(s.validate(caller).is_err());
        }
        let mut s = s;
        s.enabled.push("arbitrary-command".into());
        assert!(s.validate("main").is_err());
    }
    #[test]
    fn checks_and_availability_are_authoritative() {
        let mut s = state();
        assert!(s.checked("songs"));
        assert!(s.checked("repeat-off"));
        assert!(!s.checked("shuffle"));
        assert!(s.allows("toggle"));
        assert!(!s.allows("next"));
        assert!(s.allows("exit"));
        assert!(!s.allows("unknown"));
        s.shuffle = true;
        s.repeat = "one".into();
        s.section = "year".into();
        assert!(s.checked("shuffle"));
        assert!(s.checked("repeat-one"));
        assert!(!s.checked("repeat-off"));
        assert!(s.checked("year"));
    }
}
