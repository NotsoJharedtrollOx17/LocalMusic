//! Endpoint callbacks only signal the worker; no COM work runs in audio callbacks.
use super::engine::Engine;
use std::sync::{atomic::Ordering, Arc};
use windows::{
    core::{implement, PCWSTR},
    Win32::{Foundation::PROPERTYKEY, Media::Audio::*, System::Com::*},
};
#[implement(IMMNotificationClient)]
struct Watcher {
    engine: Arc<Engine>,
}
impl IMMNotificationClient_Impl for Watcher_Impl {
    fn OnDeviceStateChanged(&self, _: &PCWSTR, _: DEVICE_STATE) -> windows::core::Result<()> {
        self.engine.route_generation.fetch_add(1, Ordering::AcqRel);
        self.engine.route_changed.store(true, Ordering::Release);
        Ok(())
    }
    fn OnDeviceAdded(&self, _: &PCWSTR) -> windows::core::Result<()> {
        Ok(())
    }
    fn OnDeviceRemoved(&self, _: &PCWSTR) -> windows::core::Result<()> {
        self.engine.route_generation.fetch_add(1, Ordering::AcqRel);
        self.engine.route_changed.store(true, Ordering::Release);
        Ok(())
    }
    fn OnDefaultDeviceChanged(
        &self,
        flow: EDataFlow,
        role: ERole,
        _: &PCWSTR,
    ) -> windows::core::Result<()> {
        if flow == eRender && (role == eMultimedia || role == eConsole) {
            self.engine.route_generation.fetch_add(1, Ordering::AcqRel);
            self.engine.route_changed.store(true, Ordering::Release);
        }
        Ok(())
    }
    fn OnPropertyValueChanged(&self, _: &PCWSTR, _: &PROPERTYKEY) -> windows::core::Result<()> {
        Ok(())
    }
}
pub struct Monitor {
    enumerator: IMMDeviceEnumerator,
    watcher: IMMNotificationClient,
}
pub fn monitor(engine: Arc<Engine>) -> windows::core::Result<Monitor> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let watcher: IMMNotificationClient = Watcher { engine }.into();
        enumerator.RegisterEndpointNotificationCallback(&watcher)?;
        Ok(Monitor {
            enumerator,
            watcher,
        })
    }
}
impl Drop for Monitor {
    fn drop(&mut self) {
        unsafe {
            let _ = self
                .enumerator
                .UnregisterEndpointNotificationCallback(&self.watcher);
            CoUninitialize();
        }
    }
}
