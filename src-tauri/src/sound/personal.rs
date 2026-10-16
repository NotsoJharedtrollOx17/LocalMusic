pub use super::personal_protocol::Protocol;
use super::{
    dsp::{bank, headroom, Prepared, Processor},
    model::{Config, Profile, FREQUENCIES},
};
const FREQ: [u32; 6] = super::calibration::FREQUENCIES;
pub fn derive(values: [Option<f64>; 6]) -> [f64; 10] {
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
    if !FREQ.contains(&f) || !super::calibration::LEVELS.contains(&level) || ear > 1 {
        return Err("Invalid test tone".into());
    }
    let frames = 163200;
    let mut out = vec![0f32; frames * 2];
    for i in 0..frames {
        let local = i % 62400;
        if local >= 38400 {
            continue;
        }
        let fade = (local as f64 / 4800.)
            .min((38399 - local) as f64 / 4800.)
            .clamp(0., 1.);
        out[i * 2 + ear] = ((2. * std::f64::consts::PI * f as f64 * local as f64 / 48000.).sin()
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
        assert_eq!(p.len(), 326400);
        assert!(p[76800..124800].iter().all(|x| *x == 0.));
        assert!(p
            .chunks(2)
            .all(|f| f[0] == 0. && f[1].abs() <= 10f32.powf(-36. / 20.) + 1e-6));
    }
}
