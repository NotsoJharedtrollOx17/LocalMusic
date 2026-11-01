//! Application entry point: platform plugins, startup and command registration.
mod album_order;
mod about_window;
mod artwork;
#[cfg(not(target_os = "android"))]
mod catalog;
mod commands;
mod desktop_windows;
mod desktop_menu;
mod playback;
mod sound;
mod state;
#[cfg(not(target_os = "android"))]
mod visualizer;
mod webview_policy;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    #[cfg(not(target_os = "android"))]
    let context = {
        let mut context = context;
        for window in &mut context.config_mut().app.windows {
            window.visible = false;
        }
        context
    };
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_dialog::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_native_music::init());
    builder
        .manage(desktop_windows::Windows::default())
        .manage(desktop_menu::DesktopMenu::default())
        .on_window_event(desktop_windows::window_event)
        .setup(state::setup)
        .invoke_handler(tauri::generate_handler![
            commands::recommendations::playlist_context,
            commands::recommendations::set_suggestion_feedback,
            commands::recommendations::analysis_activity,
            commands::recommendations::analyze_next,
            commands::catalog::filter_track_ids,
            commands::catalog::set_library_visibility,
            commands::sharing::share_audio,
            commands::sound::sound_capabilities,
            commands::sound::set_sound,
            commands::sound::sound_action,
            commands::visualizer::start_visualizer,
            commands::visualizer::read_visualizer,
            commands::visualizer::stop_visualizer,
            commands::window::show_main_window,
            desktop_windows::desktop_state,
            desktop_windows::desktop_action,
            desktop_windows::desktop_changed,
            desktop_menu::desktop_menu_sync,
            about_window::desktop_about,
            commands::settings::patch_settings,
            commands::catalog::list_tracks,
            commands::catalog::list_groups,
            commands::catalog::group_ids,
            commands::catalog::tracks_by_id,
            commands::catalog::resolve_cover,
            commands::imports::import_music,
            commands::imports::cancel_import,
            commands::catalog::set_favorite,
            commands::playlists::automatic_playlists,
            commands::playlists::list_playlists,
            commands::playlists::save_playlist,
            commands::playlists::delete_playlist,
            commands::playlists::generate_playlist,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::recap::get_recap,
            commands::recap::save_snapshot,
            commands::recap::list_snapshots,
            commands::recap::delete_history,
            commands::playback::playback_snapshot,
            commands::playback::play_queue,
            commands::playback::toggle_playback,
            commands::playback::seek,
            commands::playback::next_track,
            commands::playback::previous_track,
            commands::playback::set_shuffle,
            commands::playback::set_repeat,
            commands::playback::set_excluded,
            commands::playback::reorder_queue,
            commands::sharing::export_file
        ])
        .run(context)
        .expect("Failed to run Local Music");
}
