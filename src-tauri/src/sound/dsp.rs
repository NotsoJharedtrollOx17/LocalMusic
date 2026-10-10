use super::model::FREQUENCIES;
pub type Coefficients = [f64; 5];
pub type Bank = [[Coefficients; 10]; 2];
pub fn coefficients(f: f64, g: f64, rate: f64) -> Coefficients {
    if g == 0. || f >= rate / 2. {
        return [1., 0., 0., 0., 0.];
    }
    let a = 10f64.powf(g / 40.);
    let w = 2. * std::f64::consts::PI * f / rate;
    let alpha = w.sin() / (2. * 1.4);
    let a0 = 1. + alpha / a;
    [
        (1. + alpha * a) / a0,
        -2. * w.cos() / a0,
        (1. - alpha * a) / a0,
        -2. * w.cos() / a0,
        (1. - alpha / a) / a0,
    ]
}
pub fn bank(curves: [[f64; 10]; 2], rate: f64) -> Bank {
    std::array::from_fn(|ch| {
        std::array::from_fn(|i| coefficients(FREQUENCIES[i], curves[ch][i], rate))
    })
}
pub fn response(c: Coefficients, f: f64, rate: f64) -> f64 {
    let w = 2. * std::f64::consts::PI * f / rate;
    let nr = c[0] + c[1] * w.cos() + c[2] * (2. * w).cos();
    let ni = -c[1] * w.sin() - c[2] * (2. * w).sin();
    let dr = 1. + c[3] * w.cos() + c[4] * (2. * w).cos();
    let di = -c[3] * w.sin() - c[4] * (2. * w).sin();
    10. * ((nr * nr + ni * ni) / (dr * dr + di * di)).log10()
}
pub fn headroom(b: &Bank, rate: f64) -> f64 {
    let mut peak = 0f64;
    for i in 0..4096 {
        let f = 20. * (rate * 0.499 / 20.).powf(i as f64 / 4095.);
        for ear in b {
            peak = peak.max(ear.iter().map(|c| response(*c, f, rate)).sum());
        }
    }
    if peak > 0.0001 {
        peak + 1.
    } else {
        0.
    }
}
#[derive(Clone)]
pub struct Prepared {
    pub bank: Bank,
    pub gain: f64,
    pub bypass: bool,
    pub attenuation: f64,
    pub generation: u64,
}
#[derive(Clone)]
struct Filters {
    bank: Bank,
    memory: Vec<[[f64; 2]; 10]>,
    gain: f64,
    bypass: bool,
}
impl Filters {
    fn new(p: &Prepared, channels: usize) -> Self {
        Self {
            bank: p.bank,
            memory: vec![[[0.; 2]; 10]; channels],
            gain: p.gain,
            bypass: p.bypass,
        }
    }
    fn process(&mut self, frame: &mut [f64]) {
        if self.bypass {
            return;
        }
        for (ch, x) in frame.iter_mut().enumerate() {
            *x *= self.gain;
            for (i, c) in self.bank[ch.min(1)].iter().enumerate() {
                let s = &mut self.memory[ch][i];
                let y = c[0] * *x + s[0];
                s[0] = c[1] * *x - c[3] * y + s[1];
                s[1] = c[2] * *x - c[4] * y;
                *x = y;
            }
        }
    }
}
pub struct Processor {
    current: Filters,
    old: Option<Filters>,
    remaining: usize,
    total: usize,
    limiter: f64,
    release: f64,
    scratch: Vec<f64>,
}
impl Processor {
    pub fn new(p: &Prepared, rate: u32, channels: usize) -> Self {
        Self {
            current: Filters::new(p, channels),
            old: None,
            remaining: 0,
            total: (rate as f64 * 0.02).round() as usize,
            limiter: 1.,
            release: (-1. / (rate as f64 * 0.05)).exp(),
            scratch: vec![0.; channels],
        }
    }
    pub fn configure(&mut self, p: &Prepared) {
        let mut next = Filters::new(p, self.scratch.len());
        std::mem::swap(&mut next, &mut self.current);
        self.old = Some(next);
        self.remaining = self.total;
    }
    pub fn process(&mut self, frame: &mut [f64]) {
        self.scratch.copy_from_slice(frame);
        self.current.process(frame);
        if self.remaining > 0 {
            if let Some(old) = self.old.as_mut() {
                old.process(&mut self.scratch);
                let t = 1. - self.remaining as f64 / self.total as f64;
                for (i, x) in frame.iter_mut().enumerate() {
                    *x = self.scratch[i] * (1. - t) + *x * t;
                }
            }
            self.remaining -= 1;
            if self.remaining == 0 {
                self.old = None;
            }
        }
        if self.current.bypass && self.old.is_none() {
            return;
        }
        let peak = frame.iter().fold(0f64, |v, x| v.max(x.abs()));
        let target = (10f64.powf(-1. / 20.) / peak.max(1e-12)).min(1.);
        self.limiter = target.min(1. - (1. - self.limiter) * self.release);
        for x in frame {
            *x *= self.limiter;
        }
    }
    pub fn reset(&mut self) {
        self.current.memory.fill([[0.; 2]; 10]);
        self.old = None;
        self.remaining = 0;
        self.limiter = 1.;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn response_and_bypass() {
        let c = coefficients(1000., 6., 48000.);
        assert!((response(c, 1000., 48000.) - 6.).abs() < 1e-8);
        let b = bank([[0.; 10]; 2], 48000.);
        assert_eq!(headroom(&b, 48000.), 0.);
        let p = Prepared {
            bank: b,
            gain: 1.,
            bypass: true,
            attenuation: 0.,
            generation: 0,
        };
        let mut dsp = Processor::new(&p, 48000, 2);
        let mut f = [0.99, -0.8];
        dsp.process(&mut f);
        assert_eq!(f, [0.99, -0.8]);
    }
    #[test]
    fn limiter_is_linked_and_finite() {
        let p = Prepared {
            bank: bank([[0.; 10]; 2], 48000.),
            gain: 20.,
            bypass: false,
            attenuation: 0.,
            generation: 0,
        };
        let mut dsp = Processor::new(&p, 48000, 2);
        let mut f = [1., 0.5];
        dsp.process(&mut f);
        assert!(f[0] <= 10f64.powf(-1. / 20.) + 1e-10);
        assert!((f[0] / f[1] - 2.).abs() < 1e-10);
    }
}

#[cfg(test)]
mod fixtures {
    use super::*;
    #[test]
    fn shared_coefficient_fixtures() {
        for row in include_str!("../../../tests/fixtures/sound-dsp.csv")
            .lines()
            .skip(1)
        {
            let v: Vec<f64> = row.split(',').map(|x| x.parse().unwrap()).collect();
            let actual = coefficients(v[1], v[2], v[0]);
            for i in 0..5 {
                assert!((actual[i] - v[i + 3]).abs() < 1e-10);
            }
        }
    }
}
