use super::{
    dsp::{self, Prepared},
    model::*,
};
use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering},
    Mutex,
};
pub struct Engine {
    #[cfg(not(target_os = "android"))]
    pub visualizer: std::sync::Arc<crate::visualizer::Visualizer>,
    pub config: Mutex<Config>,
    pub prepared: Mutex<Prepared>,
    pub rate: AtomicU32,
    pub channels: AtomicUsize,
    pub available: AtomicBool,
    pub playing: AtomicBool,
    pub route_changed: AtomicBool,
    pub route_monitoring: AtomicBool,
    pub bypass: AtomicBool,
    persistence_error: Mutex<Option<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_off_preamp_and_bounds_are_upgraded_before_processing() {
        let engine = Engine::new(Config::default());
        let mut c = Config::default();
        c.enabled = false;
        c.preamp = 12.;
        c.gains = [12.; 10];
        engine.configure(c.clone()).unwrap();
        let saved = engine.config.lock().unwrap();
        assert!(saved.enabled);
        assert_eq!(saved.preamp, 0.);
        assert_eq!(saved.gains[0], 0.);
        assert_eq!(saved.gains[5], 10.);
        assert_eq!(saved.preset_id, "custom");
        assert_eq!(engine.prepared.lock().unwrap().gain, 1.);
        drop(saved);
        c.preamp = 12.5;
        assert!(engine.configure(c).is_err());
    }
    #[test]
    fn persistence_failure_keeps_processing_bypassed_until_saved_configuration() {
        let engine = Engine::new(Config::default());
        engine.persistence_failed("Disk full".into());
        assert_eq!(engine.state().status, "failed");
        assert_eq!(engine.state().reason.as_deref(), Some("Disk full"));
        assert!(engine.prepared.lock().unwrap().bypass);
        engine.configure(Config::default()).unwrap();
        assert_ne!(engine.state().status, "failed");
        assert!(!engine.prepared.lock().unwrap().bypass);
    }
    #[test]
    fn configuration_remains_editable_without_an_output() {
        let engine = Engine::new(Config::default());
        let mut c = Config::default();
        c.enabled = true;
        c.gains[5] = 6.;
        engine.configure(c).unwrap();
        let state = engine.state();
        assert!(state.supported);
        assert_eq!(state.status, "output-unavailable");
        assert_eq!(state.config.gains[5], 6.);
        assert_eq!(state.attenuation, 0.);
        assert!(
            (engine.prepared.lock().unwrap().gain - 10f64.powf(-state.attenuation / 20.)).abs()
                < 1e-9
        );
    }
}
impl Engine {
    pub fn new(mut config: Config) -> Self {
        config = config.normalized();
        let b = dsp::bank(config.curves(false, 2), 48000.);
        let attenuation = 0.;
        let p = Prepared {
            bank: b,
            gain: 10f64.powf((if config.enabled { config.preamp } else { 0. } - attenuation) / 20.),
            bypass: !config.enabled,
            attenuation,
            generation: 1,
        };
        Self {
            #[cfg(not(target_os = "android"))]
            visualizer: crate::visualizer::Visualizer::new(),
            config: Mutex::new(config),
            prepared: Mutex::new(p),
            rate: AtomicU32::new(48000),
            channels: AtomicUsize::new(2),
            available: AtomicBool::new(false),
            playing: AtomicBool::new(false),
            route_changed: AtomicBool::new(false),
            route_monitoring: AtomicBool::new(false),
            bypass: AtomicBool::new(false),
            persistence_error: Mutex::new(None),
        }
    }
    pub fn configure(&self, mut c: Config) -> Result<(), String> {
        c.validate()?;
        c = c.normalized();
        *self.config.lock().unwrap() = c;
        *self.persistence_error.lock().unwrap() = None;
        self.prepare();
        Ok(())
    }
    pub fn persistence_failed(&self, error: String) {
        *self.persistence_error.lock().unwrap() = Some(error);
        self.prepare();
    }
    pub fn prepare(&self) {
        let rate = self.rate.load(Ordering::Relaxed);
        let channels = self.channels.load(Ordering::Relaxed);
        let c = self.config.lock().unwrap().clone();
        let bypass =
            self.bypass.load(Ordering::Relaxed) || self.persistence_error.lock().unwrap().is_some();
        let b = dsp::bank(c.curves(bypass, channels), rate as f64);
        let attenuation = 0.;
        let mut p = self.prepared.lock().unwrap();
        let generation = p.generation + 1;
        *p = Prepared {
            bank: b,
            gain: 10f64
                .powf((if !bypass && (c.enabled) { c.preamp } else { 0. } - attenuation) / 20.),
            bypass: bypass || !c.enabled,
            attenuation,
            generation,
        };
    }
    pub fn state(&self) -> State {
        let rate = self.rate.load(Ordering::Relaxed);
        let channels = self.channels.load(Ordering::Relaxed);
        let failure = self.persistence_error.lock().unwrap().clone();
        State {
            supported: true,

            config: self.config.lock().unwrap().clone(),
            status: if failure.is_some() {
                "failed"
            } else if !self.available.load(Ordering::Relaxed) {
                "output-unavailable"
            } else if self.playing.load(Ordering::Relaxed) {
                "active"
            } else {
                "ready"
            }
            .into(),
            reason: failure,
            sample_rate: rate,
            channels,
            attenuation: self.prepared.lock().unwrap().attenuation,
            bypass: self.bypass.load(Ordering::Relaxed),
            inactive_bands: FREQUENCIES
                .iter()
                .enumerate()
                .filter_map(|(i, f)| (*f >= rate as f64 / 2.).then_some(i))
                .collect(),
            route_monitoring: self.route_monitoring.load(Ordering::Relaxed),
        }
    }
}
