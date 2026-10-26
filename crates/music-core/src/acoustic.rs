use crate::recommendation::AcousticFeature;
pub const N: usize = 2048;
pub fn excerpts(duration: f64) -> Vec<(f64, f64)> {
    if !duration.is_finite() || duration <= 0.0 {
        return vec![];
    }
    if duration <= 24.0 {
        return vec![(0.0, duration)];
    }
    let mut out: Vec<(f64, f64)> = Vec::new();
    for ratio in [0.15, 0.5, 0.85] {
        let start = (duration * ratio - 4.0)
            .max(out.last().map_or(0.0, |v| v.1))
            .min(duration - 8.0);
        if out.last().is_none_or(|v| start >= v.1) {
            out.push((start, start + 8.0));
        }
    }
    out
}
pub struct AcousticAnalysis {
    real: Vec<f64>,
    imag: Vec<f64>,
    window: Vec<f64>,
    bands: Vec<f64>,
    cos: Vec<f64>,
    sin: Vec<f64>,
    seconds: f64,
}
impl Default for AcousticAnalysis {
    fn default() -> Self {
        Self {
            real: vec![0.0; N],
            imag: vec![0.0; N],
            window: (0..N)
                .map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / (N - 1) as f64).cos())
                .collect(),
            bands: vec![0.0; 32],
            cos: (0..N / 2)
                .map(|i| (2.0 * std::f64::consts::PI * i as f64 / N as f64).cos())
                .collect(),
            sin: (0..N / 2)
                .map(|i| -(2.0 * std::f64::consts::PI * i as f64 / N as f64).sin())
                .collect(),
            seconds: 0.0,
        }
    }
}
impl AcousticAnalysis {
    pub fn add(&mut self, channels: &[Vec<f32>], rate: u32) {
        if !(8000..=192000).contains(&rate) || channels.is_empty() || channels.len() > 8 {
            return;
        }
        for offset in (0..channels[0].len() / N * N).step_by(N) {
            for channel in channels {
                if channel.len() < offset + N {
                    return;
                }
                for i in 0..N {
                    let v = channel[offset + i] as f64;
                    self.real[i] = if v.is_finite() {
                        v * self.window[i]
                    } else {
                        0.0
                    };
                    self.imag[i] = 0.0;
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
                    for base in (0..N).step_by(size) {
                        for k in 0..size / 2 {
                            let a = base + k;
                            let b = a + size / 2;
                            let c = self.cos[k * N / size];
                            let s = self.sin[k * N / size];
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
                for k in 1..=N / 2 {
                    let hz = k as f64 * rate as f64 / N as f64;
                    if !(40.0..20000.0).contains(&hz) {
                        continue;
                    }
                    let b = ((hz / 40.0).ln() / 500f64.ln() * 32.0).floor().min(31.0) as usize;
                    self.bands[b] += (self.real[k].powi(2) + self.imag[k].powi(2))
                        / (N * N * channels.len()) as f64;
                }
            }
            self.seconds += N as f64 / rate as f64;
        }
    }
    pub fn finish(&self, fingerprint: String) -> Option<AcousticFeature> {
        let total = self.bands.iter().sum::<f64>();
        if self.seconds < 0.1 || total / self.seconds < 1e-10 {
            return None;
        }
        Some(AcousticFeature {
            version: 1,
            fingerprint,
            bands: self.bands.iter().map(|v| v / total).collect(),
            seconds: self.seconds,
        })
    }
}
