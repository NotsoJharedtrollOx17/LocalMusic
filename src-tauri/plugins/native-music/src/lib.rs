use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};
pub struct NativeMusic<R: Runtime>(PluginHandle<R>);
impl<R: Runtime> NativeMusic<R> {
    pub fn call<T: serde::de::DeserializeOwned>(
        &self,
        name: &str,
        payload: serde_json::Value,
    ) -> Result<T, String> {
        self.0
            .run_mobile_plugin(name, payload)
            .map_err(|e| e.to_string())
    }
}
pub trait NativeMusicExt<R: Runtime> {
    fn native_music(&self) -> &NativeMusic<R>;
}
impl<R: Runtime, T: Manager<R>> NativeMusicExt<R> for T {
    fn native_music(&self) -> &NativeMusic<R> {
        self.state::<NativeMusic<R>>().inner()
    }
}
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("native-music")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    api.register_android_plugin("com.plugin.native_music", "NativeMusicPlugin")?;
                app.manage(NativeMusic(handle));
            }
            let _ = (app, api);
            Ok(())
        })
        .build()
}
