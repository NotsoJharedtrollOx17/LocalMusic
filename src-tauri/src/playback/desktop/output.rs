//! A silent output still consumes the real decoder/DSP chain, at bounded real time.
use rodio::mixer::{mixer, Mixer};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, Instant};

pub(super) enum Output {
    Device(rodio::MixerDeviceSink),
    Silent {
        mixer: Mixer,
        stop: Arc<AtomicBool>,
        worker: Option<std::thread::JoinHandle<()>>,
    },
}
impl Output {
    pub fn silent() -> Self {
        let (mixer, mut source) = mixer(2.try_into().unwrap(), 48000.try_into().unwrap());
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let worker = std::thread::spawn(move || {
            let quantum = Duration::from_millis(10);
            let mut last = Instant::now();
            while !flag.load(Ordering::Acquire) {
                let began = Instant::now();
                // Never drain more than one quantum after a delayed wake-up.
                let elapsed = began.duration_since(last).min(Duration::from_millis(25));
                last = began;
                let samples = (elapsed.as_secs_f64() * 48000.).floor() as usize * 2;
                for _ in 0..samples {
                    let _ = source.next();
                }
                std::thread::sleep(quantum.saturating_sub(began.elapsed()));
            }
        });
        Self::Silent {
            mixer,
            stop,
            worker: Some(worker),
        }
    }
    pub fn mixer(&self) -> &Mixer {
        match self {
            Self::Device(d) => d.mixer(),
            Self::Silent { mixer, .. } => mixer,
        }
    }
    pub fn physical(&self) -> bool {
        matches!(self, Self::Device(_))
    }
}
impl Drop for Output {
    fn drop(&mut self) {
        if let Self::Silent { stop, worker, .. } = self {
            stop.store(true, Ordering::Release);
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn silent_output_consumes_pcm_in_real_time_and_honors_pause_seek_and_completion() {
        let output = Output::silent();
        let player = rodio::Player::connect_new(output.mixer());
        player.append(rodio::buffer::SamplesBuffer::new(
            2.try_into().unwrap(),
            48000.try_into().unwrap(),
            vec![0.1f32; 76800],
        ));
        std::thread::sleep(Duration::from_millis(120));
        let position = player.get_pos();
        assert!(position >= Duration::from_millis(40) && position < Duration::from_millis(350));
        player.pause();
        std::thread::sleep(Duration::from_millis(40));
        let paused = player.get_pos();
        std::thread::sleep(Duration::from_millis(60));
        assert_eq!(paused, player.get_pos());
        player.try_seek(Duration::from_millis(700)).unwrap();
        player.play();
        let until = Instant::now() + Duration::from_secs(2);
        while !player.empty() && Instant::now() < until {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(player.empty());
    }
}
