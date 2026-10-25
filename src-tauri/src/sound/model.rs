use serde::{Deserialize, Serialize};
pub const FREQUENCIES: [f64; 10] = [
    31., 63., 125., 250., 500., 1000., 2000., 4000., 8000., 16000.,
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
pub struct Config {
    pub version: u8,
    pub enabled: bool,
    pub gains: [f64; 10],
    pub preamp: f64,
    pub preset_id: String,
    pub presets: Vec<Preset>,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            version: 2,
            enabled: true,
            gains: [0.; 10],
            preamp: 0.,
            preset_id: "flat".into(),
            presets: vec![],
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<(), String> {
        let range = |v: f64, a: f64, b: f64| v.is_finite() && v >= a && v <= b;
        let name = |s: &String| !s.trim().is_empty() && s.chars().count() <= 60;
        if ![1, 2].contains(&self.version)
            || !self.gains.iter().all(|v| range(*v, -12., 12.))
            || !range(self.preamp, -12., 12.)
            || self.presets.len() > 101
        {
            return Err("Invalid sound configuration".into());
        }
        let mut ids = std::collections::HashSet::new();
        for id in [
            "flat",
            "pop",
            "rock",
            "jazz",
            "classical",
            "bass",
            "treble",
            "voice",
        ] {
            ids.insert(id.to_string());
        }
        for p in &self.presets {
            if !name(&p.id)
                || !name(&p.name)
                || !ids.insert(p.id.clone())
                || !p.gains.iter().all(|v| range(*v, -12., 12.))
                || !range(p.preamp, -12., 12.)
            {
                return Err("Invalid sound preset".into());
            }
        }
        Ok(())
    }
    /// Upgrade stored EQ and discard retired fields through EQ-only serialization.
    pub fn normalized(mut self) -> Self {
        self.enabled = true;
        self.preamp = 0.;
        self.version = 2;
        let editable = |gains: &mut [f64; 10]| {
            for (i, g) in gains.iter_mut().enumerate() {
                *g = if i == 0 { 0. } else { g.clamp(-10., 10.) };
            }
        };
        editable(&mut self.gains);
        if let Some(p) = self.presets.iter_mut().find(|p| p.id == "custom") {
            editable(&mut p.gains);
            p.preamp = 0.;
        }
        let expected = match self.preset_id.as_str() {
            "flat" => Some([0.; 10]),
            "pop" => Some([0., 0., 1., 2., 2., 1., 0., 0., 1., 2.]),
            "rock" => Some([0., 2., 1., -1., -2., -1., 1., 2., 3., 2.]),
            "jazz" => Some([0., 1., 0., -1., 0., 1., 2., 2., 1., 0.]),
            "classical" => Some([0., 1., 0., 0., -1., 0., 1., 1., 2., 2.]),
            _ => None,
        };
        if expected != Some(self.gains) {
            self.preset_id = "custom".into();
            self.presets.retain(|p| p.id != "custom");
            self.presets.push(Preset {
                id: "custom".into(),
                name: "Custom".into(),
                gains: self.gains,
                preamp: 0.,
            });
        }
        self
    }
    pub fn curves(&self, bypass: bool, _channels: usize) -> [[f64; 10]; 2] {
        let gains = std::array::from_fn(|i| {
            if i > 0 && self.enabled && !bypass {
                self.gains[i]
            } else {
                0.
            }
        });
        [gains, gains]
    }
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub supported: bool,

    pub config: Config,
    pub status: String,
    pub reason: Option<String>,
    pub sample_rate: u32,
    pub channels: usize,
    pub attenuation: f64,
    pub bypass: bool,
    pub inactive_bands: Vec<usize>,
    pub route_monitoring: bool,
}

#[cfg(test)]
mod normalization_tests {
    use super::*;
    #[test]
    fn shared_normalization_fixtures() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../../../tests/fixtures/sound-normalization.json"
        ))
        .unwrap();
        for case in cases.as_array().unwrap() {
            let config: Config = serde_json::from_value(case["input"].clone()).unwrap();
            config.validate().unwrap();
            let normalized = config.normalized();
            assert_eq!(
                normalized.curves(false, 6),
                [normalized.gains, normalized.gains]
            );
            let actual = serde_json::to_value(normalized.clone()).unwrap();
            assert_eq!(
                actual,
                serde_json::to_value(normalized.normalized()).unwrap()
            );
            assert_eq!(actual.as_object().unwrap().len(), 6);
            let expected: Config = serde_json::from_value(case["expected"].clone()).unwrap();
            assert_eq!(
                actual,
                serde_json::to_value(expected).unwrap(),
                "{}",
                case["name"]
            );
        }
    }
}
