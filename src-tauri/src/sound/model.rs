use serde::{Deserialize, Serialize};
pub const FREQUENCIES: [f64; 10] = [
    31., 62., 125., 250., 500., 1000., 2000., 4000., 8000., 16000.,
];
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub gains: [f64; 10],
    pub preamp: f64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub left: [f64; 10],
    pub right: [f64; 10],
    pub complete: [bool; 12],
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u8,
    pub enabled: bool,
    pub gains: [f64; 10],
    pub preamp: f64,
    pub preset_id: String,
    pub presets: Vec<Preset>,
    pub profiles: Vec<Profile>,
    pub profile_id: Option<String>,
    pub personal_enabled: bool,
    pub strength: f64,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            version: 1,
            enabled: false,
            gains: [0.; 10],
            preamp: 0.,
            preset_id: "flat".into(),
            presets: vec![],
            profiles: vec![],
            profile_id: None,
            personal_enabled: false,
            strength: 50.,
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<(), String> {
        let range = |v: f64, a: f64, b: f64| v.is_finite() && v >= a && v <= b;
        let name = |s: &String| !s.trim().is_empty() && s.chars().count() <= 60;
        if self.version != 1
            || !self.gains.iter().all(|v| range(*v, -12., 12.))
            || !range(self.preamp, -12., 0.)
            || !range(self.strength, 0., 100.)
            || self.presets.len() > 100
            || self.profiles.len() > 100
        {
            return Err("Invalid sound configuration".into());
        }
        let mut ids = std::collections::HashSet::new();
        for id in ["flat", "pop", "rock", "jazz", "classical", "bass", "voice"] {
            ids.insert(id.to_string());
        }
        for p in &self.presets {
            if !name(&p.id)
                || !name(&p.name)
                || !ids.insert(p.id.clone())
                || !p.gains.iter().all(|v| range(*v, -12., 12.))
                || !range(p.preamp, -12., 0.)
            {
                return Err("Invalid sound preset".into());
            }
        }
        ids.clear();
        for p in &self.profiles {
            if !name(&p.id)
                || !name(&p.name)
                || !ids.insert(p.id.clone())
                || !p
                    .left
                    .iter()
                    .chain(p.right.iter())
                    .all(|v| range(*v, 0., 6.))
            {
                return Err("Invalid personal profile".into());
            }
        }
        if self.profile_id.as_ref().is_some_and(|id| !ids.contains(id))
            || (self.personal_enabled && self.profile_id.is_none())
        {
            return Err("Choose a valid personal profile".into());
        }
        Ok(())
    }
    pub fn curves(&self, bypass: bool, channels: usize) -> [[f64; 10]; 2] {
        let mut out = [[0.; 10]; 2];
        let p = if self.personal_enabled && !bypass && channels <= 2 {
            self.profiles
                .iter()
                .find(|p| Some(&p.id) == self.profile_id.as_ref())
        } else {
            None
        };
        for ch in 0..2 {
            for i in 0..10 {
                out[ch][i] = if self.enabled && !bypass {
                    self.gains[i]
                } else {
                    0.
                } + p
                    .map(|p| if ch == 0 { p.left[i] } else { p.right[i] })
                    .unwrap_or(0.)
                    * self.strength
                    / 100.;
            }
        }
        out
    }
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub supported: bool,
    pub system_panel: bool,
    pub config: Config,
    pub status: String,
    pub reason: Option<String>,
    pub sample_rate: u32,
    pub channels: usize,
    pub attenuation: f64,
    pub bypass: bool,
    pub inactive_bands: Vec<usize>,
    pub personal_available: bool,
    pub route_monitoring: bool,
    pub route_generation: usize,
}
