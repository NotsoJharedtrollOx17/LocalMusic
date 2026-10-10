use super::{
    dsp::{self, Prepared},
    model::*,
    personal::Protocol,
};
use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering},
    Mutex,
};
pub struct Engine {
    pub config: Mutex<Config>,
    pub prepared: Mutex<Prepared>,
    pub rate: AtomicU32,
    pub channels: AtomicUsize,
    pub available: AtomicBool,
    pub playing: AtomicBool,
    pub route_changed: AtomicBool,
    pub route_monitoring: AtomicBool,
    pub route_generation: AtomicUsize,
    pub session: Mutex<Option<Protocol>>,
    pub bypass: AtomicBool,
}

#[cfg(test)]
mod tests {
    use super::*;
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
        assert!((state.attenuation - 7.).abs() < 0.01);
        assert!(
            (engine.prepared.lock().unwrap().gain - 10f64.powf(-state.attenuation / 20.)).abs()
                < 1e-9
        );
    }
}
impl Engine {
    pub fn new(mut config: Config) -> Self {
        config.personal_enabled = false;
        let b = dsp::bank(config.curves(false, 2), 48000.);
        let attenuation = dsp::headroom(&b, 48000.);
        let p = Prepared {
            bank: b,
            gain: 10f64.powf((if config.enabled { config.preamp } else { 0. } - attenuation) / 20.),
            bypass: !config.enabled,
            attenuation,
            generation: 1,
        };
        Self {
            config: Mutex::new(config),
            prepared: Mutex::new(p),
            rate: AtomicU32::new(48000),
            channels: AtomicUsize::new(2),
            available: AtomicBool::new(false),
            playing: AtomicBool::new(false),
            route_changed: AtomicBool::new(false),
            route_monitoring: AtomicBool::new(false),
            route_generation: AtomicUsize::new(0),
            session: Mutex::new(None),
            bypass: AtomicBool::new(false),
        }
    }
    pub fn configure(&self, c: Config) -> Result<(), String> {
        c.validate()?;
        *self.config.lock().unwrap() = c;
        self.prepare();
        Ok(())
    }
    pub fn prepare(&self) {
        let rate = self.rate.load(Ordering::Relaxed);
        let channels = self.channels.load(Ordering::Relaxed);
        let c = self.config.lock().unwrap().clone();
        let bypass = self.bypass.load(Ordering::Relaxed);
        let b = dsp::bank(c.curves(bypass, channels), rate as f64);
        let attenuation = dsp::headroom(&b, rate as f64);
        let mut p = self.prepared.lock().unwrap();
        let generation = p.generation + 1;
        *p = Prepared {
            bank: b,
            gain: 10f64
                .powf((if c.enabled && !bypass { c.preamp } else { 0. } - attenuation) / 20.),
            bypass: bypass || (!c.enabled && !c.personal_enabled) || (!c.enabled && channels > 2),
            attenuation,
            generation,
        };
    }
    pub fn state(&self) -> State {
        let rate = self.rate.load(Ordering::Relaxed);
        let channels = self.channels.load(Ordering::Relaxed);
        State {
            supported: true,
            system_panel: false,
            config: self.config.lock().unwrap().clone(),
            status: if !self.available.load(Ordering::Relaxed) {
                "output-unavailable"
            } else if self.playing.load(Ordering::Relaxed) {
                "active"
            } else {
                "ready"
            }
            .into(),
            reason: None,
            sample_rate: rate,
            channels,
            attenuation: self.prepared.lock().unwrap().attenuation,
            bypass: self.bypass.load(Ordering::Relaxed),
            inactive_bands: FREQUENCIES
                .iter()
                .enumerate()
                .filter_map(|(i, f)| (*f >= rate as f64 / 2.).then_some(i))
                .collect(),
            personal_available: channels <= 2,
            route_monitoring: self.route_monitoring.load(Ordering::Relaxed),
            route_generation: self.route_generation.load(Ordering::Acquire),
        }
    }
}
