use super::{
    dsp::{bank, headroom, Prepared, Processor},
    model::{Config, Profile, FREQUENCIES},
};
use serde::Serialize;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
const FREQ: [u32; 7] = [1000, 250, 500, 2000, 4000, 8000, 1000];
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub id: String,
    pub phase: String,
    pub ear: usize,
    pub step: usize,
    pub frequency: u32,
    pub level: i32,
    pub awaiting: bool,
    pub busy_until: u64,
    pub message: String,
    pub strength: f64,
}
pub struct Protocol {
    pub replace_id: Option<String>,
    pub view: View,
    values: [[Option<i32>; 6]; 2],
    lease: Instant,
    end: Instant,
    next: Instant,
}
impl Protocol {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            view: View {
                id: uuid::Uuid::new_v4().to_string(),
                phase: "test".into(),
                ear: 0,
                step: 0,
                frequency: 1000,
                level: -54,
                awaiting: false,
                busy_until: 0,
                message: String::new(),
                strength: 50.,
            },
            replace_id: None,
            values: [[None; 6]; 2],
            lease: now + Duration::from_secs(2),
            end: now,
            next: now,
        }
    }
    pub fn alive(&self) -> bool {
        self.view.phase != "cancelled"
            && (self.view.phase == "saved" || Instant::now() < self.lease)
    }
    pub fn heartbeat(&mut self) -> Result<(), String> {
        if !self.alive() {
            self.cancel();
            return Err("Sound setup expired. Start again.".into());
        }
        self.lease = Instant::now() + Duration::from_secs(2);
        Ok(())
    }
    pub fn cancel(&mut self) {
        self.view.phase = "cancelled".into();
        self.view.awaiting = false;
        self.values = [[None; 6]; 2];
    }
    pub fn discard(&mut self) {
        self.values = [[None; 6]; 2];
    }
    pub fn pulse(&mut self) -> Result<Vec<f32>, String> {
        self.heartbeat()?;
        let now = Instant::now();
        if self.view.phase != "test" || now < self.next {
            return Err("Wait before playing another tone".into());
        }
        self.end = now + Duration::from_millis(800);
        self.next = self.end + Duration::from_millis(500);
        self.view.awaiting = true;
        self.view.busy_until = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
            + 800;
        tone(self.view.frequency, self.view.level, self.view.ear)
    }
    pub fn respond(&mut self, heard: bool) -> Result<(), String> {
        self.heartbeat()?;
        let s = &mut self.view;
        if s.phase != "test" || !s.awaiting || Instant::now() < self.end {
            return Err("Play the tone and wait for it to finish first".into());
        }
        s.awaiting = false;
        if !heard && s.level < -36 {
            s.level += 6;
            return Ok(());
        }
        let value = if heard { Some(s.level) } else { None };
        if s.step == 0 && value.is_none() {
            s.phase = "retry".into();
            s.message = "reference-unheard".into();
            return Ok(());
        }
        if s.step < 6 {
            self.values[s.ear][s.step] = value;
        } else if value.is_none() || (value.unwrap() - self.values[s.ear][0].unwrap_or(0)).abs() > 6
        {
            s.phase = "retry".into();
            s.message = "reference-inconsistent".into();
            return Ok(());
        }
        if s.step == 6 {
            if s.ear == 1 {
                s.phase = "compare".into();
                return Ok(());
            }
            s.ear = 1;
            s.step = 0;
        } else {
            s.step += 1;
        }
        s.frequency = FREQ[s.step];
        s.level = -54;
        Ok(())
    }
    pub fn retry(&mut self) -> Result<(), String> {
        self.heartbeat()?;
        self.values[self.view.ear] = [None; 6];
        self.view.phase = "test".into();
        self.view.step = 0;
        self.view.frequency = 1000;
        self.view.level = -54;
        self.view.awaiting = false;
        self.view.message.clear();
        Ok(())
    }
    pub fn profile(&self, name: &str) -> Result<Profile, String> {
        if self.view.phase != "compare" || name.trim().is_empty() || name.chars().count() > 60 {
            return Err("Finish setup and provide a name (1-60 characters)".into());
        }
        Ok(Profile {
            id: self
                .replace_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            name: name.trim().into(),
            left: derive(self.values[0]),
            right: derive(self.values[1]),
            complete: std::array::from_fn(|i| self.values[i / 6][i % 6].is_some()),
        })
    }
}
pub fn derive(values: [Option<i32>; 6]) -> [f64; 10] {
    let fs = [250., 500., 1000., 2000., 4000., 8000.];
    let indexes = [1, 2, 0, 3, 4, 5];
    std::array::from_fn(|n| {
        let f = FREQUENCIES[n];
        let Some(reference) = values[0] else {
            return 0.;
        };
        if !(250. ..=8000.).contains(&f) {
            return 0.;
        }
        let i = fs.iter().position(|v| *v >= f).unwrap();
        let j = i.saturating_sub(1);
        if f == fs[i] {
            return values[indexes[i]]
                .map(|v| (v - reference) as f64)
                .unwrap_or(0.)
                .clamp(0., 6.);
        }
        let (Some(a), Some(b)) = (values[indexes[j]], values[indexes[i]]) else {
            return 0.;
        };
        let t = if i == j {
            0.
        } else {
            (f / fs[j]).ln() / (fs[i] / fs[j]).ln()
        };
        (a as f64 + (b - a) as f64 * t - reference as f64).clamp(0., 6.)
    })
}
pub fn tone(f: u32, level: i32, ear: usize) -> Result<Vec<f32>, String> {
    if !FREQ.contains(&f) || ![-54, -48, -42, -36].contains(&level) || ear > 1 {
        return Err("Invalid test tone".into());
    }
    let frames = 38400;
    let mut out = vec![0f32; frames * 2];
    for i in 0..frames {
        let fade = (i as f64 / 4800.)
            .min((frames - 1 - i) as f64 / 4800.)
            .clamp(0., 1.);
        out[i * 2 + ear] = ((2. * std::f64::consts::PI * f as f64 * i as f64 / 48000.).sin()
            * 10f64.powf(level as f64 / 20.)
            * fade) as f32;
    }
    Ok(out)
}
pub fn comparison(profile: Profile, strength: f64, personal: bool) -> Vec<f32> {
    let mut config = Config::default();
    config.personal_enabled = true;
    config.profile_id = Some(profile.id.clone());
    config.profiles.push(profile);
    config.strength = strength;
    let b = bank(config.curves(false, 2), 48000.);
    let attenuation = headroom(&b, 48000.);
    let p = Prepared {
        bank: b,
        gain: 10f64.powf(-attenuation / 20.),
        bypass: false,
        attenuation,
        generation: 0,
    };
    let mut dsp = Processor::new(&p, 48000, 2);
    let notes = [220., 261.63, 329.63, 293.66];
    let mut original = Vec::with_capacity(384000);
    let mut processed = Vec::with_capacity(384000);
    let (mut a, mut b) = (0f64, 0f64);
    for i in 0..192000 {
        let t = i as f64 / 48000.;
        let local = t % 1.;
        let env = (local / 0.05).min((1. - local) / 0.1).min(1.);
        let w = 2. * std::f64::consts::PI * notes[t.floor() as usize] * t;
        let x = (w.sin() + 0.3 * (2. * w).sin() + 0.15 * (4. * w).sin()) * 0.025 * env;
        let mut frame = [x, x];
        dsp.process(&mut frame);
        original.extend([x, x]);
        processed.extend(frame);
        a += 2. * x * x;
        b += frame[0] * frame[0] + frame[1] * frame[1];
    }
    let gain = (a.min(b) / if personal { b } else { a }.max(1e-20)).sqrt();
    (if personal { processed } else { original })
        .into_iter()
        .map(|x| (x * gain) as f32)
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn tone_cap_and_isolation() {
        assert!(tone(1000, -12, 0).is_err());
        let p = tone(1000, -36, 1).unwrap();
        assert!(p
            .chunks(2)
            .all(|f| f[0] == 0. && f[1].abs() <= 10f32.powf(-36. / 20.) + 1e-6));
    }
    #[test]
    fn protocol_rejects_early_response_and_uses_relative_curve() {
        let mut p = Protocol::new();
        assert!(p.respond(true).is_err());
        p.pulse().unwrap();
        assert!(p.pulse().is_err());
        assert!(p.respond(true).is_err());
        let curve = derive([Some(-48), Some(-42), Some(-48), Some(-42), Some(-36), None]);
        assert_eq!(curve[3], 6.);
        assert_eq!(curve[5], 0.);
        assert_eq!(curve[8], 0.);
        p.cancel();
        assert!(p.heartbeat().is_err());
    }
}
