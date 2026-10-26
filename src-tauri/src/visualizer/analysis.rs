use serde::Serialize;
pub const N: usize = 2048;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub generation: u64,
    pub sequence: u64,
    pub position_ms: f64,
    pub sample_rate: u32,
    pub spectrum: Vec<f64>,
    pub waveform: Vec<f64>,
    pub rms: f64,
    pub bass: f64,
    pub mid: f64,
    pub treble: f64,
    pub onset: f64,
}
pub struct Analysis {
    real: Vec<f64>,
    imag: Vec<f64>,
    power: Vec<f64>,
    window: Vec<f64>,
    cos: Vec<f64>,
    sin: Vec<f64>,
    previous: f64,
}
impl Analysis {
    pub fn new() -> Self {
        let pi = std::f64::consts::PI;
        Self {
            real: vec![0.; N],
            imag: vec![0.; N],
            power: vec![0.; N / 2 + 1],
            previous: 0.,
            window: (0..N)
                .map(|i| {
                    0.42 - 0.5 * (2. * pi * i as f64 / (N - 1) as f64).cos()
                        + 0.08 * (4. * pi * i as f64 / (N - 1) as f64).cos()
                })
                .collect(),
            cos: (0..N / 2)
                .map(|i| (2. * pi * i as f64 / N as f64).cos())
                .collect(),
            sin: (0..N / 2)
                .map(|i| -(2. * pi * i as f64 / N as f64).sin())
                .collect(),
        }
    }
    pub fn analyze(&mut self, left: &[f64], right: &[f64], rate: u32) -> Frame {
        self.power.fill(0.);
        let mut lp = 0.;
        let mut rp = 0.;
        for channel in 0..2 {
            let samples = if channel == 0 { left } else { right };
            for i in 0..N {
                let v = if samples[i].is_finite() {
                    samples[i]
                } else {
                    0.
                };
                if channel == 0 {
                    lp += v * v
                } else {
                    rp += v * v
                };
                self.real[i] = v * self.window[i];
                self.imag[i] = 0.;
            }
            let mut j = 0;
            for i in 1..N {
                let mut bit = N >> 1;
                while j & bit != 0 {
                    j ^= bit;
                    bit >>= 1;
                }
                j ^= bit;
                if i < j {
                    self.real.swap(i, j);
                }
            }
            let mut size = 2;
            while size <= N {
                let half = size / 2;
                let step = N / size;
                for base in (0..N).step_by(size) {
                    for k in 0..half {
                        let a = base + k;
                        let b = a + half;
                        let c = self.cos[k * step];
                        let s = self.sin[k * step];
                        let re = c * self.real[b] - s * self.imag[b];
                        let im = s * self.real[b] + c * self.imag[b];
                        self.real[b] = self.real[a] - re;
                        self.imag[b] = self.imag[a] - im;
                        self.real[a] += re;
                        self.imag[a] += im;
                    }
                }
                size *= 2;
            }
            for i in 0..=N / 2 {
                self.power[i] += (self.real[i] * self.real[i] + self.imag[i] * self.imag[i]) / 2.;
            }
        }
        let mut spectrum = vec![0.; 64];
        let mut waveform = vec![0.; 256];
        let upper = (rate as f64 / 2.).min(20000.).max(41.);
        for b in 0..64 {
            let lo = (40. * (upper / 40.).powf(b as f64 / 64.) * N as f64 / rate as f64)
                .floor()
                .max(1.) as usize;
            let hi = (40. * (upper / 40.).powf((b + 1) as f64 / 64.) * N as f64 / rate as f64)
                .ceil()
                .max(lo as f64)
                .min((N / 2) as f64) as usize;
            let peak = (lo..=hi).map(|k| self.power[k]).fold(0., f64::max);
            let db = 20. * (2. * peak.sqrt() / (N as f64 * 0.42)).max(1e-12).log10();
            spectrum[b] = ((db + 72.) / 72.).clamp(0., 1.);
        }
        let wave = if rp > lp { right } else { left };
        for i in 0..128 {
            let mut min = 1f64;
            let mut max = -1f64;
            for j in i * 16..(i + 1) * 16 {
                let x = if wave[j].is_finite() { wave[j] } else { 0. };
                min = min.min(x);
                max = max.max(x);
            }
            waveform[i * 2] = min.max(-1.);
            waveform[i * 2 + 1] = max.min(1.);
        }
        let rms = ((lp + rp) / (2 * N) as f64).sqrt();
        let onset = ((rms - self.previous) * 8.).clamp(0., 1.);
        self.previous = rms;
        Frame {
            generation: 0,
            sequence: 0,
            position_ms: 0.,
            sample_rate: rate,
            bass: spectrum[..20].iter().copied().fold(0., f64::max),
            mid: spectrum[20..42].iter().copied().fold(0., f64::max),
            treble: spectrum[42..].iter().copied().fold(0., f64::max),
            spectrum,
            waveform,
            rms,
            onset,
        }
    }
}
