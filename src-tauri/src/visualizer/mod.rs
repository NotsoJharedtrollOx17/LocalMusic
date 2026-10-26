pub mod analysis;
#[cfg(test)]
mod tests;
use analysis::{Analysis, Frame, N};
use std::{
    sync::{
        atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering::*},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
const CAP: usize = 131072;
struct Sample {
    left: AtomicU32,
    right: AtomicU32,
    position: AtomicU64,
    epoch: AtomicU64,
    ticket: AtomicU64,
}
/// One PCM writer, one worker. Publication never locks or waits on the audio thread.
pub struct Visualizer {
    ring: Vec<Sample>,
    cursor: AtomicU64,
    pub epoch: AtomicU64,
    rate: AtomicU32,
    active: AtomicBool,
    session: AtomicU64,
    deadline: AtomicU64,
    origin: Instant,
    position: AtomicU64,
    playing: AtomicBool,
    frame: Mutex<Option<Frame>>,
}
impl Visualizer {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            ring: (0..CAP)
                .map(|_| Sample {
                    left: AtomicU32::new(0),
                    right: AtomicU32::new(0),
                    position: AtomicU64::new(0),
                    epoch: AtomicU64::new(0),
                    ticket: AtomicU64::new(0),
                })
                .collect(),
            cursor: AtomicU64::new(0),
            epoch: AtomicU64::new(1),
            rate: AtomicU32::new(48000),
            active: AtomicBool::new(false),
            session: AtomicU64::new(0),
            deadline: AtomicU64::new(0),
            origin: Instant::now(),
            position: AtomicU64::new(0),
            playing: AtomicBool::new(false),
            frame: Mutex::new(None),
        })
    }
    pub fn reset(&self, rate: u32) -> u64 {
        self.rate.store(rate, Relaxed);
        self.epoch.fetch_add(1, AcqRel) + 1
    }
    pub fn capture(&self, epoch: u64, frame: &[f64], position_ms: f64) {
        if !self.active.load(Relaxed) || epoch != self.epoch.load(Relaxed) {
            return;
        }
        let mut l = frame[0];
        let mut r = *frame.get(1).unwrap_or(&l);
        for (ch, &v) in frame.iter().enumerate().skip(2) {
            if ch % 2 == 0 {
                if v.abs() > l.abs() {
                    l = v
                }
            } else if v.abs() > r.abs() {
                r = v
            }
        }
        let cursor = self.cursor.load(Relaxed);
        let slot = &self.ring[cursor as usize % CAP];
        slot.ticket.store(0, Release);
        slot.epoch.store(0, Release);
        slot.left.store((l as f32).to_bits(), Relaxed);
        slot.right.store((r as f32).to_bits(), Relaxed);
        slot.position.store((position_ms * 1000.) as u64, Relaxed);
        slot.epoch.store(epoch, Release);
        slot.ticket.store(cursor + 1, Release);
        self.cursor.store(cursor + 1, Release);
    }
    fn now(&self) -> u64 {
        self.origin.elapsed().as_millis() as u64
    }
    pub fn clock(&self, ms: u64, playing: bool) {
        self.position.store(ms, Relaxed);
        self.playing.store(playing, Relaxed);
    }
    pub fn start(self: &Arc<Self>) -> String {
        self.active.store(false, Release);
        let id = self.session.fetch_add(1, AcqRel) + 1;
        self.deadline.store(self.now() + 3000, Release);
        *self.frame.lock().unwrap() = None;
        self.active.store(true, Release);
        let this = self.clone();
        std::thread::spawn(move || {
            if std::panic::catch_unwind(|| this.run(id)).is_err()
                && this.session.load(Acquire) == id
            {
                this.active.store(false, Release);
            }
        });
        id.to_string()
    }
    pub fn stop(&self, id: &str) {
        if id.parse::<u64>().ok() == Some(self.session.load(Acquire)) {
            self.active.store(false, Release);
            *self.frame.lock().unwrap() = None;
        }
    }
    pub fn read(&self, id: &str) -> Result<Option<Frame>, String> {
        if id.parse::<u64>().ok() != Some(self.session.load(Acquire))
            || !self.active.load(Acquire)
            || self.now() > self.deadline.load(Acquire)
        {
            return Err("Expired visualizer".into());
        }
        self.deadline.store(self.now() + 3000, Release);
        let pos = self.position.load(Relaxed) as f64;
        Ok(self
            .frame
            .lock()
            .unwrap()
            .as_ref()
            .filter(|f| {
                f.generation == self.epoch.load(Acquire)
                    && f.position_ms <= pos + 25.
                    && pos - f.position_ms < 160.
                    && self.playing.load(Relaxed)
            })
            .cloned())
    }
    fn run(&self, id: u64) {
        let mut analysis = Analysis::new();
        let mut left = vec![0.; N];
        let mut right = vec![0.; N];
        let mut last = 0;
        let mut sequence = 0;
        let mut previous_epoch = 0;
        let mut awake = false;
        while self.active.load(Acquire)
            && self.session.load(Acquire) == id
            && self.now() <= self.deadline.load(Acquire)
        {
            let playing = self.playing.load(Relaxed);
            if awake != playing {
                display_awake(playing);
                awake = playing;
            }
            if playing {
                let cursor = self.cursor.load(Acquire);
                let epoch = self.epoch.load(Acquire);
                let rate = self.rate.load(Relaxed);
                let target = self.position.load(Relaxed) * 1000 + N as u64 * 500000 / rate as u64;
                let mut end = cursor;
                while end > cursor.saturating_sub(CAP as u64) && end > 0 {
                    let s = &self.ring[(end - 1) as usize % CAP];
                    if s.epoch.load(Acquire) != epoch {
                        break;
                    }
                    if s.position.load(Relaxed) <= target {
                        break;
                    }
                    end -= 1;
                }
                if end >= N as u64 && end != last {
                    let mut valid = true;
                    for i in 0..N {
                        let s = &self.ring[(end - N as u64 + i as u64) as usize % CAP];
                        if s.epoch.load(Acquire) != epoch
                            || s.ticket.load(Acquire) != end - N as u64 + i as u64 + 1
                        {
                            valid = false;
                            break;
                        }
                        left[i] = f32::from_bits(s.left.load(Relaxed)) as f64;
                        right[i] = f32::from_bits(s.right.load(Relaxed)) as f64;
                        if s.epoch.load(Acquire) != epoch
                            || s.ticket.load(Acquire) != end - N as u64 + i as u64 + 1
                        {
                            valid = false;
                            break;
                        }
                    }
                    if valid && epoch == self.epoch.load(Acquire) {
                        if previous_epoch != epoch {
                            analysis = Analysis::new();
                            previous_epoch = epoch;
                        }
                        let mut f = analysis.analyze(&left, &right, rate);
                        sequence += 1;
                        f.generation = epoch;
                        f.sequence = sequence;
                        f.position_ms = self.ring[(end - 1) as usize % CAP].position.load(Relaxed)
                            as f64
                            / 1000.
                            - N as f64 / rate as f64 * 500.;
                        if self.session.load(Acquire) == id && self.active.load(Acquire) {
                            *self.frame.lock().unwrap() = Some(f);
                        }
                        last = end;
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(34));
        }
        display_awake(false);
        if self.session.load(Acquire) == id {
            self.active.store(false, Release);
            *self.frame.lock().unwrap() = None;
        }
    }
}
fn display_awake(active: bool) {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::System::Power::*;
        let _ = SetThreadExecutionState(if active {
            ES_CONTINUOUS | ES_DISPLAY_REQUIRED
        } else {
            ES_CONTINUOUS
        });
    }
    #[cfg(not(windows))]
    let _ = active;
}
