fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "library_load",
            "library_import",
            "library_cancel",
            "library_favorite",
            "player_snapshot",
            "player_command",
            "scene_track",
            "lyrics_import",
            "settings_load",
            "settings_save",
            "display_list",
            "wallpaper_set_enabled",
            "wallpaper_status",
            "visual_import",
            "window_action",
            "shortcuts_set",
        ]),
    ))
    .expect("Tauri permission manifest generation failed")
}
