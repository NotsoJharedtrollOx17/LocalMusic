fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("gnu")
    {
        // The desktop executable uses the rlib. Its unused cdylib has no C exports;
        // stop MinGW auto-exporting the entire WebView/audio dependency graph.
        println!("cargo:rustc-cdylib-link-arg=-Wl,--exclude-all-symbols");
    }
    tauri_build::build()
}
