//! Suppress browser chrome without disabling editing, zoom or app shortcuts.
pub(crate) fn configure(app: &tauri::App) -> tauri::Result<()> {
    use tauri::Manager;
    for window in app.webview_windows().values() {
        configure_window(window)?;
    }
    Ok(())
}
pub(crate) fn configure_window(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        use webview2_com::AcceleratorKeyPressedEventHandler;
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
            COREWEBVIEW2_PHYSICAL_KEY_STATUS,
        };
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
        };

        {
            let owner = window.clone();
            window.with_webview(move |webview| {
                // These COM interfaces are used on the WebView's UI thread.
                let configure = || -> windows::core::Result<()> {
                    unsafe {
                        let controller = webview.controller();
                        let settings = controller.CoreWebView2()?.Settings()?;
                        settings.SetAreDefaultContextMenusEnabled(false)?;
                        settings.SetAreDevToolsEnabled(false)?;
                        let handler =
                            AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
                                if let Some(args) = args {
                                    let mut key = 0;
                                    args.VirtualKey(&mut key)?;
                                    let control = GetKeyState(VK_CONTROL.0 as i32) < 0;
                                    if blocked_key(key, control) {
                                        args.SetHandled(true)?;
                                    } else if let Some(id) = crate::desktop_menu::shortcut(
                                        key,
                                        control,
                                        GetKeyState(VK_MENU.0 as i32) < 0,
                                        GetKeyState(VK_SHIFT.0 as i32) < 0,
                                    ) {
                                        let mut kind = COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN;
                                        args.KeyEventKind(&mut kind)?;
                                        let mut status =
                                            COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();
                                        args.PhysicalKeyStatus(&mut status)?;
                                        let pressed = (kind
                                            == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN
                                            || kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN)
                                            && !status.WasKeyDown.as_bool();
                                        if crate::desktop_menu::accelerator(&owner, id, pressed) {
                                            args.SetHandled(true)?;
                                        }
                                    }
                                }
                                Ok(())
                            }));
                        let mut token = 0;
                        controller.add_AcceleratorKeyPressed(&handler, &mut token)?;
                    }
                    Ok(())
                };
                if let Err(error) = configure() {
                    eprintln!("Could not configure app WebView controls: {error}");
                }
            })?;
        }
    }
    #[cfg(not(windows))]
    let _ = window;
    Ok(())
}

#[cfg(any(windows, test))]
fn blocked_key(key: u32, control: bool) -> bool {
    matches!(key, 0x74 | 0x7b) || (control && key == 0x52) // F5, F12, Ctrl+R
}

#[cfg(test)]
mod tests {
    use super::blocked_key;

    #[test]
    fn blocks_browser_actions_without_consuming_editing_or_zoom() {
        assert!(blocked_key(0x74, false));
        assert!(blocked_key(0x7b, false));
        assert!(blocked_key(0x52, true));
        for key in [0x52, 0x43, 0x56, 0x41, 0x6b, 0xbb, 0xbd, 0x30, 0x25] {
            assert!(!blocked_key(key, key != 0x52));
        }
    }
}
